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
    
    if (pathParts.length < 2) {
      return errorResponse('无效的文件路径', 400);
    }
    
    const r2Key = pathParts[1];
    
    // 检查 Range 请求头
    const range = request.headers.get('range');
    
    let object: R2ObjectBody | null;
    
    if (range) {
      // Range 请求 - 用于视频流式播放
      const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
      if (!rangeMatch) {
        return errorResponse('无效的 Range 请求', 400);
      }
      
      const start = parseInt(rangeMatch[1]);
      const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : undefined;
      
      object = await env.R2_BUCKET.get(r2Key, {
        range: { offset: start, length: end ? end - start + 1 : undefined },
      });
    } else {
      // 普通请求
      object = await env.R2_BUCKET.get(r2Key);
    }
    
    if (!object) {
      return errorResponse('文件不存在', 404);
    }
    
    const headers = new Headers();
    
    // 设置 Content-Type
    if (object.httpMetadata?.contentType) {
      headers.set('Content-Type', object.httpMetadata.contentType);
    }
    
    // 设置缓存策略
    const folder = r2Key.split('/')[0];
    if (folder === 'avatars' || folder === 'covers') {
      // 头像和封面 - 长时间缓存
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (folder === 'videos' || folder === 'audios') {
      // 视频和音频 - 中等缓存
      headers.set('Cache-Control', 'public, max-age=86400');
    } else {
      // 其他文件 - 短期缓存
      headers.set('Cache-Control', 'public, max-age=3600');
    }
    
    // Range 响应
    if (range && object.range && 'offset' in object.range) {
      headers.set('Content-Range', `bytes ${object.range.offset}-${object.range.offset + (object.size || 0) - 1}/${object.size || 0}`);
      headers.set('Content-Length', (object.size || 0).toString());
      headers.set('Accept-Ranges', 'bytes');
      
      return new Response(object.body, {
        status: 206, // Partial Content
        headers,
      });
    }
    
    // 普通响应
    headers.set('Content-Length', (object.size || 0).toString());
    headers.set('Accept-Ranges', 'bytes');
    
    return new Response(object.body, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Media proxy error:', error);
    return errorResponse('获取文件失败', 500);
  }
}
