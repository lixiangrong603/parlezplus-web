// Cloudflare Pages Functions 全局中间件
// 文档: https://developers.cloudflare.com/pages/functions/middleware/

import type { Env } from '../types/worker';
import { handleOptions, corsHeaders, errorResponse } from './utils';

export async function onRequest(context: any): Promise<Response> {
  const { request, next, env } = context;
  
  // 处理 CORS 预检请求
  if (request.method === 'OPTIONS') {
    return handleOptions(request);
  }
  
  try {
    // 执行后续处理
    const response = await next();
    
    // 添加 CORS 头到所有响应
    const newHeaders = new Headers(response.headers);
    const origin = request.headers.get('Origin');
    if (origin) {
      Object.entries(corsHeaders(origin)).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    console.error('Middleware error:', error);
    return errorResponse('Internal server error', 500);
  }
}
