// R2 媒体文件代理 API (支持 Range 请求 + Cloudflare Edge Cache 加速)

import type { Env } from '../../../types/worker';
import { errorResponse } from '../../utils';

// ============================================
// GET /api/media/:path - 访问 R2 文件
// 支持 Range 请求以实现视频流式播放
// 启用 Cloudflare Edge Cache 全球加速
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
    
    const encodedKeyPart = pathParts[1];
    const r2Key = decodeURIComponent(encodedKeyPart);
    const folder = r2Key.split('/')[0];

    // 如果已配置 R2 自定义域名，生产环境下直接重定向到直连地址
    // 这样旧的 /api/media 链接依然可用，但媒体下载不再经过 Worker。
    const mediaBaseUrl = (env.MEDIA_BASE_URL || '').trim().replace(/\/$/, '');
    if (mediaBaseUrl && (request.method === 'GET' || request.method === 'HEAD')) {
      const targetUrl = `${mediaBaseUrl}/${encodedKeyPart}${url.search}`;
      return Response.redirect(targetUrl, 302);
    }
    
    // 尝试从 Cloudflare Edge Cache 获取
    const cache = (globalThis as any).caches?.default as Cache | undefined;
    const cacheKey = new Request(url.toString(), request);
    const cachedResponse = cache ? await cache.match(cacheKey) : undefined;
    
    if (cachedResponse) {
      // 命中缓存，直接返回
      return cachedResponse;
    }
    
    // 缓存未命中，从 R2 获取
    const headObject = await env.R2_BUCKET.head(r2Key);
    if (!headObject) {
      return errorResponse('文件不存在', 404);
    }
    
    const totalSize = headObject.size;
    const contentType = headObject.httpMetadata?.contentType || 'application/octet-stream';
    const etag = headObject.httpEtag || headObject.etag;
    const lastModified = headObject.uploaded;
    
    // 检查 If-None-Match (ETag 验证)
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch && etag && ifNoneMatch === etag) {
      return new Response(null, { status: 304 });
    }
    
    // 检查 Range 请求头
    const range = request.headers.get('range');
    
    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Alt-Svc', 'clear');
    
    // ETag 和 Last-Modified 用于缓存验证
    if (etag) headers.set('ETag', etag);
    if (lastModified) headers.set('Last-Modified', lastModified.toUTCString());
    
    // 设置缓存策略（浏览器 + CDN）
    let cacheControl: string;
    let cdnCacheTtl: number;
    
    if (folder === 'avatars' || folder === 'covers') {
      // 图片：长期缓存
      cacheControl = 'public, max-age=31536000, immutable';
      cdnCacheTtl = 31536000; // 1 年
    } else if (folder === 'videos' || folder === 'audios') {
      // 视频音频：1天浏览器缓存，7天CDN缓存
      cacheControl = 'public, max-age=86400, s-maxage=604800';
      cdnCacheTtl = 604800; // 7 天
    } else {
      // 其他：1小时浏览器，1天CDN
      cacheControl = 'public, max-age=3600, s-maxage=86400';
      cdnCacheTtl = 86400; // 1 天
    }
    
    headers.set('Cache-Control', cacheControl);
    
    if (range) {
      // Range 请求 - 用于视频/音频流式播放
      const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
      if (!rangeMatch) {
        return errorResponse('无效的 Range 请求', 400);
      }
      
      const start = parseInt(rangeMatch[1]);
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
      
      const response = new Response(object.body, {
        status: 206, // Partial Content
        headers,
      });
      
      // Range 请求也缓存（小范围请求通常是首次加载）
      if (start === 0 && chunkSize <= 5 * 1024 * 1024) { // 前5MB缓存
        context.waitUntil(cache.put(cacheKey, response.clone()));
      }
      
      return response;
    }
    
    // 普通请求 - 返回完整文件
    const object = await env.R2_BUCKET.get(r2Key);
    if (!object) {
      return errorResponse('无法读取文件内容', 500);
    }
    
    headers.set('Content-Length', totalSize.toString());
    
    const response = new Response(object.body, {
      status: 200,
      headers,
    });
    
    // 将响应缓存到 Cloudflare Edge（异步，不阻塞响应）
    // 大文件（>10MB）不缓存完整内容，依赖 Range 请求
    if (totalSize <= 10 * 1024 * 1024) {
      context.waitUntil(cache.put(cacheKey, response.clone()));
    }
    
    return response;
  } catch (error) {
    console.error('Media proxy error:', error);
    return errorResponse('获取文件失败', 500);
  }
}
