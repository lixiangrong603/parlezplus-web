// Gemini AI API 代理 (中国访问优化关键)

import type { Env } from '../../types/worker';
import { getUserFromRequest, decryptApiKey, jsonResponse, errorResponse } from '../utils';

// ============================================
// POST /api/proxy-gemini - 代理 Gemini API 请求
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    // 验证用户身份
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    // 从数据库获取用户的加密 Gemini Key
    const keyRecord = await env.DB
      .prepare('SELECT gemini_key_encrypted FROM user_api_keys WHERE user_id = ?')
      .bind(user.id)
      .first<{ gemini_key_encrypted: string | null }>();
    
    if (!keyRecord?.gemini_key_encrypted) {
      return errorResponse('未配置 Gemini API Key，请在设置中添加', 400);
    }
    
    // 解密 API Key
    const apiKey = await decryptApiKey(keyRecord.gemini_key_encrypted, env.GEMINI_MASTER_KEY || '');
    
    // 获取请求体
    const body = await request.json();
    
    // TODO: 未来扩展 - 根据用户地理位置路由到不同 AI 服务
    // const country = request.cf?.country;
    // if (country === 'CN') {
    //   // 路由到百度文心一言
    //   return proxyToBaiduWenxin(body, env);
    // }
    
    // 转发到 Gemini API
    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
      }
    );
    
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      
      // 检查常见错误
      if (errorText.includes('API key not valid')) {
        return errorResponse('Gemini API Key 无效，请在设置中更新', 400);
      }
      
      if (errorText.includes('quota')) {
        return errorResponse('Gemini API 配额已用尽', 429);
      }
      
      return errorResponse('Gemini API 调用失败: ' + errorText, geminiResponse.status);
    }
    
    const responseData = await geminiResponse.json();
    return jsonResponse(responseData);
  } catch (error) {
    console.error('Gemini proxy error:', error);
    return errorResponse('代理请求失败', 500);
  }
}

// ============================================
// 未来扩展: 百度文心一言代理 (中国用户)
// ============================================
async function proxyToBaiduWenxin(body: any, env: Env): Promise<Response> {
  // TODO: 实现百度文心一言 API 适配
  // 1. 转换请求格式 (Gemini -> 百度)
  // 2. 调用百度 API
  // 3. 转换响应格式 (百度 -> Gemini)
  
  return errorResponse('百度文心一言集成开发中', 501);
}
