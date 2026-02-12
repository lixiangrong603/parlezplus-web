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
    
    // 解析 FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string;
    
    if (!file) {
      return errorResponse('缺少文件', 400);
    }
    
    if (!folder || !['avatars', 'videos', 'audios', 'covers', 'recordings', 'questions'].includes(folder)) {
      return errorResponse('无效的文件夹类型', 400);
    }
    
    // 生成 R2 key
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const extension = file.name.split('.').pop() || 'bin';
    const r2Key = `${folder}/${user.id}/${timestamp}_${randomId}.${extension}`;

    // 缓存策略（供 R2 自定义域名直连时使用）
    let cacheControl: string;
    if (folder === 'avatars' || folder === 'covers') {
      cacheControl = 'public, max-age=31536000, immutable';
    } else if (folder === 'videos' || folder === 'audios') {
      cacheControl = 'public, max-age=86400';
    } else {
      cacheControl = 'public, max-age=3600';
    }
    
    // 上传到 R2
    await env.R2_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
        cacheControl,
      },
      customMetadata: {
        uploadedBy: user.id,
        uploadedAt: timestamp.toString(),
        originalName: file.name,
      },
    });
    
    // 生成可访问 URL：优先使用 R2 自定义域名，其次使用 Workers 代理
    const mediaBaseUrl = (env.MEDIA_BASE_URL || '').trim().replace(/\/$/, '');
    const cdnUrl = mediaBaseUrl ? `${mediaBaseUrl}/${r2Key}` : `/api/media/${r2Key}`;
    
    const result: UploadResult = {
      r2_key: r2Key,
      cdn_url: cdnUrl,
      size: file.size,
    };
    
    return jsonResponse(result);
  } catch (error) {
    console.error('Upload error:', error);
    return errorResponse('上传失败', 500);
  }
}
