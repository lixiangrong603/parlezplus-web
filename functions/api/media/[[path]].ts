// R2 媒体文件代理 API (支持 Range 请求)

import type { Env } from '../../../types/worker';
import { errorResponse } from '../../utils';

// ============================================
// GET /api/media/:path - 访问 R2 文件
// 支持 Range 请求以实现视频流式播放
// ============================================
export async function onRequest(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    // 从 URL 中提取 R2 key
    // 例如: /api/media/videos/user123/123456_abc.mp4
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/media/');
    
    if (pathParts.length < 2 || !pathParts[1]) {
      return errorResponse('无效的文件路径', 400);
    }
    
    const r2Key = decodeURIComponent(pathParts[1]);
    
    // 先获取对象元数据以得到总大小
    const headObject = await env.R2_BUCKET.head(r2Key);
    if (!headObject) {
      return errorResponse('文件不存在', 404);
    }
    
    const totalSize = headObject.size;
    const contentType = headObject.httpMetadata?.contentType || 'application/octet-stream';
    
    // 检查 Range 请求头
    const range = request.headers.get('range');
    
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Accept-Ranges', 'bytes');
    // 某些网络环境/浏览器在 HTTP/3(QUIC) 下会出现 ERR_QUIC_PROTOCOL_ERROR，
    // 对媒体流接口清除 Alt-Svc 可促使客户端优先使用 HTTP/2(TCP) 以提高稳定性。
    headers.set('Alt-Svc', 'clear');
    
    // 设置缓存策略
    const folder = r2Key.split('/')[0];
    if (folder === 'avatars' || folder === 'covers') {
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (folder === 'videos' || folder === 'audios') {
      headers.set('Cache-Control', 'public, max-age=86400');
    } else {
      headers.set('Cache-Control', 'public, max-age=3600');
    }
    
    if (range) {
      // Range 请求 - 用于视频/音频流式播放
      const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
      if (!rangeMatch) {
        return errorResponse('无效的 Range 请求', 400);
      }
      
      const start = parseInt(rangeMatch[1]);
      // 如果没有指定 end，则默认为文件末尾
      const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : totalSize - 1;
      
      // 确保范围有效
      if (start >= totalSize || end >= totalSize || start > end) {
        headers.set('Content-Range', `bytes */${totalSize}`);
        return new Response(null, { status: 416, headers });
      }
      
      const chunkSize = end - start + 1;
      
      // 获取指定范围的内容
      const object = await env.R2_BUCKET.get(r2Key, {
        range: { offset: start, length: chunkSize },
      });
      
      if (!object) {
        return errorResponse('无法读取文件内容', 500);
      }
      
      headers.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      headers.set('Content-Length', chunkSize.toString());
      
      return new Response(object.body, {
        status: 206, // Partial Content
        headers,
      });
    }
    
    // 普通请求 - 返回完整文件
    const object = await env.R2_BUCKET.get(r2Key);
    if (!object) {
      return errorResponse('无法读取文件内容', 500);
    }
    
    headers.set('Content-Length', totalSize.toString());
    
    return new Response(object.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Media proxy error:', error);
    return errorResponse('获取文件失败', 500);
  }
}
