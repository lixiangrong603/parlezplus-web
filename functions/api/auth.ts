// 认证 API: 登录、注册、获取当前用户信息

import type { Env, User } from '../../types/worker';
import { generateJWT, verifyPassword, hashPassword, getUserFromRequest, jsonResponse, errorResponse } from '../utils';

// ============================================
// POST /api/auth/login - 用户登录
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    // [DEBUG] 环境变量检查
    if (!env.DB) {
      console.error('[AUTH] D1 database not bound!');
      return errorResponse('服务配置错误：数据库未绑定', 500);
    }
    if (!env.JWT_SECRET) {
      console.error('[AUTH] JWT_SECRET not configured!');
      return errorResponse('服务配置错误：JWT密钥未设置', 500);
    }
    
    const { username, password } = await request.json() as { username: string; password: string };
    
    if (!username || !password) {
      return errorResponse('用户名和密码不能为空', 400);
    }
    
    // 查询用户
    const user = await env.DB
      .prepare('SELECT * FROM users WHERE username = ? AND is_deleted = 0')
      .bind(username)
      .first<User>();
    
    if (!user) {
      console.log(`[AUTH] User not found: ${username}`);
      return errorResponse('用户名或密码错误', 401);
    }
    
    // 检查是否被屏蔽
    if (user.is_blocked) {
      console.log(`[AUTH] User blocked: ${username}`);
      return errorResponse('账号已被封禁', 403);
    }
    
    // 验证密码
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      console.log(`[AUTH] Invalid password for user: ${username}`);
      return errorResponse('用户名或密码错误', 401);
    }
    
    // 生成 JWT token
    const token = await generateJWT(user, env.JWT_SECRET);
    
    // 返回用户信息和 token
    const { password_hash, ...userWithoutPassword } = user;
    
    return jsonResponse({
      token,
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    return errorResponse(`登录失败: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
}

// ============================================
// GET /api/auth/me - 获取当前用户信息
// ============================================
export async function onRequestGet(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const { password_hash, ...userWithoutPassword } = user;
    return jsonResponse(userWithoutPassword);
  } catch (error) {
    console.error('Get user error:', error);
    return errorResponse('获取用户信息失败', 500);
  }
}
