// 用户管理 API (注册、密码修改)

import type { Env, User } from '../../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse, hashPassword, verifyPassword } from '../../utils';

// ============================================
// GET /api/users - 获取用户列表 (管理员查看全部，教师查看自己班级的学生)
// GET /api/users/:id - 获取单个用户信息
// ============================================
export async function onRequestGet(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    
    // 检查是否是获取单个用户 /api/users/:id
    const pathParts = url.pathname.split('/api/users/');
    const userId = pathParts[1]?.split('?')[0];
    
    if (userId && userId !== '') {
      // GET /api/users/:id - 获取单个用户
      // 权限检查：用户可以查看自己，管理员可以查看任何人，教师可以查看学生
      if (user.role !== 'admin' && user.id !== userId) {
        // 教师查看学生需要验证
        if (user.role === 'teacher') {
          const targetUser = await env.DB
            .prepare('SELECT role FROM users WHERE id = ? AND is_deleted = 0')
            .bind(userId)
            .first<{ role: string }>();
          
          if (!targetUser || targetUser.role !== 'student') {
            return errorResponse('无权限', 403);
          }
        } else {
          return errorResponse('无权限', 403);
        }
      }
      
      const targetUser = await env.DB
        .prepare('SELECT id, username, role, name, avatar_r2_key, class_id, needs_password_change, is_blocked, created_at FROM users WHERE id = ? AND is_deleted = 0')
        .bind(userId)
        .first();
      
      if (!targetUser) {
        return errorResponse('用户不存在', 404);
      }
      
      return jsonResponse(targetUser);
    }
    
    // GET /api/users - 获取用户列表
    const role = url.searchParams.get('role');
    const classId = url.searchParams.get('classId');
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    
    let query: D1PreparedStatement;
    
    if (user.role === 'admin') {
      // 管理员查看所有用户
      if (role) {
        if (includeDeleted) {
          query = env.DB
            .prepare('SELECT id, username, role, name, avatar_r2_key, class_id, needs_password_change, is_blocked, is_deleted, deleted_at, deleted_by, created_at FROM users WHERE role = ? ORDER BY created_at DESC')
            .bind(role);
        } else {
          query = env.DB
            .prepare('SELECT id, username, role, name, avatar_r2_key, class_id, needs_password_change, is_blocked, created_at FROM users WHERE role = ? AND is_deleted = 0 ORDER BY created_at DESC')
            .bind(role);
        }
      } else {
        if (includeDeleted) {
          query = env.DB
            .prepare('SELECT id, username, role, name, avatar_r2_key, class_id, needs_password_change, is_blocked, is_deleted, deleted_at, deleted_by, created_at FROM users ORDER BY created_at DESC');
        } else {
          query = env.DB
            .prepare('SELECT id, username, role, name, avatar_r2_key, class_id, needs_password_change, is_blocked, created_at FROM users WHERE is_deleted = 0 ORDER BY created_at DESC');
        }
      }
    } else if (user.role === 'teacher') {
      // 教师查看自己班级的学生
      if (classId) {
        query = env.DB
          .prepare('SELECT id, username, role, name, avatar_r2_key, class_id, created_at FROM users WHERE role = ? AND class_id = ? AND is_deleted = 0 ORDER BY name')
          .bind('student', classId);
      } else {
        return errorResponse('需要提供 classId', 400);
      }
    } else {
      return errorResponse('无权限', 403);
    }
    
    const { results } = await query.all();
    return jsonResponse(results);
  } catch (error: any) {
    return errorResponse(error.message || '获取用户列表失败', 500);
  }
}

// ============================================
// POST /api/users - 创建新用户（注册）
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const url = new URL(request.url);

    // /api/users/:id/change-password
    if (/^\/api\/users\/[^/]+\/change-password\/?$/.test(url.pathname)) {
      return onRequestPost_changePassword(context);
    }

    const user = await getUserFromRequest(request, env);

    // 只有管理员和教师可以创建用户
    if (!user || (user.role !== 'admin' && user.role !== 'teacher')) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      username: string;
      password: unknown;
      role: 'student' | 'teacher' | 'admin';
      name: string;
      classId?: string;
      needsPasswordChange?: boolean;
    };
    
    // 验证必填字段
    if (!body.username || body.password === undefined || body.password === null || !body.role || !body.name) {
      return errorResponse('缺少必填字段', 400);
    }

    if (typeof body.password !== 'string') {
      return errorResponse('password 必须是字符串', 400);
    }
    
    // 教师只能创建学生账户
    if (user.role === 'teacher' && body.role !== 'student') {
      return errorResponse('教师只能创建学生账户', 403);
    }
    
    // 检查用户名是否已存在
    const existing = await env.DB
      .prepare('SELECT id, username, role, name, class_id, is_deleted FROM users WHERE username = ?')
      .bind(body.username)
      .first<{ id: string; username: string; role: string; name: string; class_id: string | null; is_deleted: number }>();
    
    if (existing) {
      // 如果用户已被软删除，恢复该用户
      if (existing.is_deleted === 1) {
        await env.DB
          .prepare('UPDATE users SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL, class_id = ? WHERE id = ?')
          .bind(body.classId || null, existing.id)
          .run();
        return jsonResponse({ 
          id: existing.id, 
          username: existing.username, 
          role: existing.role, 
          name: existing.name,
          existed: true,
          restored: true 
        }, 200);
      }
      
      // 如果是教师创建学生，且该用户已存在且是学生角色，允许将其加入班级
      if (user.role === 'teacher' && body.role === 'student' && existing.role === 'student') {
        // 如果学生已经在目标班级中
        if (existing.class_id === body.classId) {
          return jsonResponse({ 
            id: existing.id, 
            username: existing.username, 
            role: existing.role, 
            name: existing.name,
            existed: true,
            alreadyInClass: true 
          }, 200);
        }
        
        // 将学生添加到新班级（更新 class_id）
        if (body.classId) {
          await env.DB
            .prepare('UPDATE users SET class_id = ? WHERE id = ?')
            .bind(body.classId, existing.id)
            .run();
        }
        
        return jsonResponse({ 
          id: existing.id, 
          username: existing.username, 
          role: existing.role, 
          name: existing.name,
          existed: true 
        }, 200);
      }
      
      return errorResponse('用户名已存在', 400);
    }
    
    // 生成用户 ID
    const userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // 哈希密码
    const passwordHash = await hashPassword(body.password);
    const needsPasswordChange = body.needsPasswordChange ?? true;
    
    // 插入用户
    await env.DB
      .prepare(`
        INSERT INTO users (id, username, password_hash, role, name, class_id, needs_password_change, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        userId,
        body.username,
        passwordHash,
        body.role,
        body.name,
        body.classId || null,
        needsPasswordChange ? 1 : 0,
        Date.now()
      )
      .run();
    
    return jsonResponse({ id: userId, username: body.username, role: body.role, name: body.name }, 201);
  } catch (error: any) {
    return errorResponse(error.message || '创建用户失败', 500);
  }
}

// ============================================
// PUT /api/users/:id - 更新用户信息
// ============================================
export async function onRequestPut(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    // 从 URL 获取用户 ID
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/users/');
    const targetUserId = pathParts[1]?.split('?')[0];
    
    if (!targetUserId) {
      return errorResponse('缺少用户 ID', 400);
    }
    
    const body = await request.json() as {
      name?: string;
      avatar_r2_key?: string;
      class_id?: string;
      is_blocked?: boolean;
    };
    
    // 权限检查：管理员可以修改任何人，用户只能修改自己
    if (user.role !== 'admin' && user.id !== targetUserId) {
      return errorResponse('无权限', 403);
    }
    
    // 构建更新语句
    const updates: string[] = [];
    const values: any[] = [];
    
    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    
    if (body.avatar_r2_key !== undefined) {
      updates.push('avatar_r2_key = ?');
      values.push(body.avatar_r2_key);
    }
    
    if (body.class_id !== undefined && user.role === 'admin') {
      updates.push('class_id = ?');
      values.push(body.class_id);
    }
    
    if (body.is_blocked !== undefined && user.role === 'admin') {
      updates.push('is_blocked = ?');
      values.push(body.is_blocked ? 1 : 0);
    }
    
    if (updates.length === 0) {
      return errorResponse('没有要更新的字段', 400);
    }
    
    values.push(targetUserId);
    
    await env.DB
      .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
    
    return jsonResponse({ success: true, message: '用户信息已更新' });
  } catch (error: any) {
    return errorResponse(error.message || '更新用户失败', 500);
  }
}

// ============================================
// POST /api/users/:id/change-password - 修改密码
// ============================================
export async function onRequestPost_changePassword(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/users/');
    const targetUserId = pathParts[1]?.split('/')[0];
    
    if (!targetUserId) {
      return errorResponse('缺少用户 ID', 400);
    }
    
    // 权限检查：管理员可以改任何人密码，用户只能改自己的
    if (user.role !== 'admin' && user.id !== targetUserId) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      oldPassword?: string;
      newPassword: string;
    };
    
    if (!body.newPassword) {
      return errorResponse('缺少新密码', 400);
    }
    
    // 非管理员需要验证旧密码
    if (user.role !== 'admin') {
      if (!body.oldPassword) {
        return errorResponse('缺少旧密码', 400);
      }
      
      const targetUser = await env.DB
        .prepare('SELECT password_hash FROM users WHERE id = ?')
        .bind(targetUserId)
        .first<{ password_hash: string }>();
      
      if (!targetUser) {
        return errorResponse('用户不存在', 404);
      }
      
      const valid = await verifyPassword(body.oldPassword, targetUser.password_hash);
      if (!valid) {
        return errorResponse('旧密码错误', 400);
      }
    }
    
    // 哈希新密码
    const newPasswordHash = await hashPassword(body.newPassword);

    // 管理员重置他人密码：强制目标用户下次登录改密
    const forceTargetChange = user.role === 'admin' && user.id !== targetUserId;
    
    // 更新密码，并清除需要修改密码标志
    await env.DB
      .prepare('UPDATE users SET password_hash = ?, needs_password_change = ? WHERE id = ?')
      .bind(newPasswordHash, forceTargetChange ? 1 : 0, targetUserId)
      .run();
    
    return jsonResponse({ success: true, message: '密码已修改' });
  } catch (error: any) {
    return errorResponse(error.message || '修改密码失败', 500);
  }
}

// ============================================
// DELETE /api/users/:id - 删除用户（软删除）
// ============================================
export async function onRequestDelete(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || user.role !== 'admin') {
      return errorResponse('无权限', 403);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/users/');
    const targetUserId = pathParts[1]?.split('?')[0];
    
    if (!targetUserId) {
      return errorResponse('缺少用户 ID', 400);
    }
    
    // 软删除用户
    await env.DB
      .prepare('UPDATE users SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?')
      .bind(Date.now(), user.id, targetUserId)
      .run();
    
    return jsonResponse({ success: true, message: '用户已删除' });
  } catch (error: any) {
    return errorResponse(error.message || '删除用户失败', 500);
  }
}
