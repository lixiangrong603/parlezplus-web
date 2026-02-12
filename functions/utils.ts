// Cloudflare Workers 工具函数

import type { Env, JWTPayload, User } from '../types/worker';

// ============================================
// JWT Token 处理
// ============================================

/**
 * 生成 JWT Token
 */
export async function generateJWT(user: User, secret: string): Promise<string> {
  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7天过期
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHMAC(signatureInput, secret);
  
  return `${signatureInput}.${signature}`;
}

/**
 * 验证并解析 JWT Token
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    
    // 验证签名
    const expectedSignature = await signHMAC(signatureInput, secret);
    if (signature !== expectedSignature) return null;
    
    // 解析 payload
    const payload: JWTPayload = JSON.parse(atob(encodedPayload));
    
    // 检查过期
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    
    return payload;
  } catch {
    return null;
  }
}

/**
 * HMAC-SHA256 签名
 */
async function signHMAC(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

// ============================================
// 密码哈希 (bcrypt 简化版，建议生产环境使用专门库)
// ============================================

/**
 * 哈希密码 (使用 Web Crypto API)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `$sha256$${hashHex}`;
}

/**
 * 验证密码
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

// ============================================
// API Key 加密 (AES-GCM)
// ============================================

/**
 * 加密 API Key
 */
export async function encryptApiKey(plaintext: string, masterKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  // 生成加密密钥
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterKey.padEnd(32, '0').substring(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  
  // 生成随机 IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // 加密
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    data
  );
  
  // 组合 IV + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

/**
 * 解密 API Key
 */
export async function decryptApiKey(encrypted: string, masterKey: string): Promise<string> {
  const decoder = new TextDecoder();
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterKey.padEnd(32, '0').substring(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    keyMaterial,
    ciphertext
  );
  
  return decoder.decode(plaintext);
}

// ============================================
// CORS 处理
// ============================================

/**
 * 创建 CORS 响应头
 */
export function corsHeaders(origin?: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * 处理 OPTIONS 预检请求
 */
export function handleOptions(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('Origin') || undefined),
  });
}

// ============================================
// API 响应构造
// ============================================

/**
 * 成功响应
 */
export function jsonResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

/**
 * 错误响应
 */
export function errorResponse(error: string, status = 400): Response {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

// ============================================
// 从请求中提取用户
// ============================================

/**
 * 从请求中提取并验证用户
 */
export async function getUserFromRequest(request: Request, env: Env): Promise<User | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('getUserFromRequest: 缺少或格式错误的 Authorization header');
    return null;
  }
  
  const token = authHeader.substring(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) {
    console.log('getUserFromRequest: JWT 验证失败');
    return null;
  }
  
  // 移除高频成功日志，避免生产环境日志过载
  // console.log('getUserFromRequest: JWT 验证成功 - userId:', payload.userId);
  
  // 从数据库查询用户
  const result = await env.DB
    .prepare('SELECT * FROM users WHERE id = ? AND is_deleted = 0 AND is_blocked = 0')
    .bind(payload.userId)
    .first<User>();
  
  if (!result) {
    console.log('getUserFromRequest: 数据库中未找到用户 -', payload.userId);
  }
  
  return result || null;
}
