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
    
    // 上传到 R2
    await env.R2_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
      customMetadata: {
        uploadedBy: user.id,
        uploadedAt: timestamp.toString(),
        originalName: file.name,
      },
    });
    
    // 生成 CDN URL (通过 Workers 代理访问)
    const cdnUrl = `/api/media/${r2Key}`;
    
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
