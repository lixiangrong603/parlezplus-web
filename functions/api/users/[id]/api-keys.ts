// 用户 API 密钥管理

import type { Env } from '../../../../types/worker';
import { getUserFromRequest, encryptApiKey, decryptApiKey, jsonResponse, errorResponse } from '../../../utils';

// ============================================
// GET /api/users/:id/api-keys - 获取用户的 API 配置状态
// 查询参数: decrypt=true 时返回解密后的 key (用于跨浏览器同步)
// ============================================
export async function onRequestGet(context: any): Promise<Response> {
  const { request, env, params } = context as { request: Request; env: Env; params: { id: string } };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    // 只能查看自己的配置（管理员除外）
    if (user.id !== params.id && user.role !== 'admin') {
      return errorResponse('无权访问', 403);
    }
    
    const url = new URL(request.url);
    const shouldDecrypt = url.searchParams.get('decrypt') === 'true';
    
    const keyRecord = await env.DB
      .prepare('SELECT gemini_key_encrypted, azure_key_encrypted, azure_region FROM user_api_keys WHERE user_id = ?')
      .bind(params.id)
      .first<{ gemini_key_encrypted: string | null; azure_key_encrypted: string | null; azure_region: string }>();
    
    // 基础响应
    const response: any = {
      hasGeminiKey: !!keyRecord?.gemini_key_encrypted,
      hasAzureKey: !!keyRecord?.azure_key_encrypted,
      azureRegion: keyRecord?.azure_region || 'westeurope',
    };
    
    // 如果请求解密，返回解密后的 key
    if (shouldDecrypt && keyRecord) {
      const masterKey = env.GEMINI_MASTER_KEY || env.AZURE_MASTER_KEY || '';
      
      if (keyRecord.gemini_key_encrypted && masterKey) {
        try {
          response.geminiKey = await decryptApiKey(keyRecord.gemini_key_encrypted, masterKey);
        } catch (e) {
          console.error('Failed to decrypt gemini key:', e);
        }
      }
      
      if (keyRecord.azure_key_encrypted && masterKey) {
        try {
          response.azureKey = await decryptApiKey(keyRecord.azure_key_encrypted, masterKey);
        } catch (e) {
          console.error('Failed to decrypt azure key:', e);
        }
      }
    }
    
    return jsonResponse(response);
  } catch (error) {
    console.error('Get API keys error:', error);
    return errorResponse('获取失败', 500);
  }
}

// ============================================
// PUT /api/users/:id/api-keys - 更新用户的 API 密钥
// ============================================
export async function onRequestPut(context: any): Promise<Response> {
  const { request, env, params } = context as { request: Request; env: Env; params: { id: string } };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    // 只能修改自己的配置（管理员除外）
    if (user.id !== params.id && user.role !== 'admin') {
      return errorResponse('无权修改', 403);
    }
    
    const body = await request.json() as {
      geminiKey?: string;
      azureKey?: string;
      azureRegion?: string;
    };
    
    const masterKey = env.GEMINI_MASTER_KEY || env.AZURE_MASTER_KEY || '';
    
    // 检查是否存在记录
    const existing = await env.DB
      .prepare('SELECT user_id FROM user_api_keys WHERE user_id = ?')
      .bind(params.id)
      .first();
    
    if (!existing) {
      // 插入新记录
      const geminiEncrypted = body.geminiKey ? await encryptApiKey(body.geminiKey, masterKey) : null;
      const azureEncrypted = body.azureKey ? await encryptApiKey(body.azureKey, masterKey) : null;
      
      await env.DB
        .prepare(`
          INSERT INTO user_api_keys (user_id, gemini_key_encrypted, azure_key_encrypted, azure_region)
          VALUES (?, ?, ?, ?)
        `)
        .bind(params.id, geminiEncrypted, azureEncrypted, body.azureRegion || 'westeurope')
        .run();
    } else {
      // 更新现有记录（只更新提供的字段）
      const updates: string[] = [];
      const values: any[] = [];
      
      if (body.geminiKey !== undefined) {
        const encrypted = body.geminiKey ? await encryptApiKey(body.geminiKey, masterKey) : null;
        updates.push('gemini_key_encrypted = ?');
        values.push(encrypted);
      }
      
      if (body.azureKey !== undefined) {
        const encrypted = body.azureKey ? await encryptApiKey(body.azureKey, masterKey) : null;
        updates.push('azure_key_encrypted = ?');
        values.push(encrypted);
      }
      
      if (body.azureRegion) {
        updates.push('azure_region = ?');
        values.push(body.azureRegion);
      }
      
      if (updates.length > 0) {
        values.push(params.id);
        await env.DB
          .prepare(`UPDATE user_api_keys SET ${updates.join(', ')} WHERE user_id = ?`)
          .bind(...values)
          .run();
      }
    }
    
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Update API keys error:', error);
    return errorResponse('更新失败', 500);
  }
}

// ============================================
// DELETE /api/users/:id/api-keys - 删除用户的 API 密钥
// ============================================
export async function onRequestDelete(context: any): Promise<Response> {
  const { request, env, params } = context as { request: Request; env: Env; params: { id: string } };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    // 只能删除自己的配置（管理员除外）
    if (user.id !== params.id && user.role !== 'admin') {
      return errorResponse('无权删除', 403);
    }
    
    await env.DB
      .prepare('DELETE FROM user_api_keys WHERE user_id = ?')
      .bind(params.id)
      .run();
    
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Delete API keys error:', error);
    return errorResponse('删除失败', 500);
  }
}
