// R2 文件上传 API

import type { Env, UploadResult } from '../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../utils';

// ============================================
// POST /api/upload - 上传文件到 R2
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    // 验证用户身份
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const validFolders = ['avatars', 'videos', 'audios', 'covers', 'recordings', 'questions'];

    let folder = request.headers.get('X-Upload-Folder') || '';
    let originalFileName = decodeURIComponent(request.headers.get('X-Upload-Filename') || '');
    let contentType = request.headers.get('Content-Type') || 'application/octet-stream';
    let uploadBody: ReadableStream | null = request.body;
    let uploadSize = Number(request.headers.get('Content-Length') || 0);

    // 兼容旧版 multipart/form-data 上传
    if (!folder || !validFolders.includes(folder) || !uploadBody) {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      folder = (formData.get('folder') as string) || '';

      if (!file) {
        return errorResponse('缺少文件', 400);
      }

      originalFileName = file.name || originalFileName || `upload-${Date.now()}.bin`;
      contentType = file.type || contentType;
      uploadBody = file.stream();
      uploadSize = file.size || uploadSize;
    }

    if (!folder || !validFolders.includes(folder)) {
      return errorResponse('无效的文件夹类型', 400);
    }
    
    // 生成 R2 key
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const extension = originalFileName.split('.').pop() || 'bin';
    const r2Key = `${folder}/${user.id}/${timestamp}_${randomId}.${extension}`;

    // 缓存策略（供 R2 自定义域名直连时使用）
    let cacheControl: string;
    if (folder === 'avatars' || folder === 'covers') {
      cacheControl = 'public, max-age=31536000, immutable';
    } else if (folder === 'videos' || folder === 'audios') {
      cacheControl = 'public, max-age=2592000, immutable';
    } else {
      cacheControl = 'public, max-age=3600';
    }
    
    // 上传到 R2
    await env.R2_BUCKET.put(r2Key, uploadBody as ReadableStream, {
      httpMetadata: {
        contentType: contentType || 'application/octet-stream',
        cacheControl,
      },
      customMetadata: {
        uploadedBy: user.id,
        uploadedAt: timestamp.toString(),
        originalName: originalFileName,
      },
    });
    
    // 生成可访问 URL：优先使用 R2 自定义域名，其次使用 Workers 代理
    const mediaBaseUrl = (env.MEDIA_BASE_URL || '').trim().replace(/\/$/, '');
    const versionedSuffix = `?v=${timestamp}`;
    const cdnUrl = mediaBaseUrl ? `${mediaBaseUrl}/${r2Key}${versionedSuffix}` : `/api/media/${r2Key}${versionedSuffix}`;
    
    // 自动预热 CDN 缓存（异步，不阻塞响应）
    if (mediaBaseUrl) {
      const warmupUrl = `${mediaBaseUrl}/${r2Key}${versionedSuffix}`;
      context.waitUntil(
        fetch(warmupUrl, { method: 'HEAD' })
          .then(() => console.log(`CDN warmed up: ${r2Key}`))
          .catch((err: Error) => console.warn(`CDN warmup failed: ${r2Key}`, err.message))
      );
    }
    
    const result: UploadResult = {
      r2_key: r2Key,
      cdn_url: cdnUrl,
      size: uploadSize,
    };
    
    return jsonResponse(result);
  } catch (error) {
    console.error('Upload error:', error);
    return errorResponse('上传失败', 500);
  }
}
