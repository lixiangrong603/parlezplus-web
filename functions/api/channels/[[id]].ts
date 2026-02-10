// 频道管理 API (CRUD)

import type { Env, Channel } from '../../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../../utils';

// ============================================
// GET /api/channels - 获取频道列表
// ============================================
export async function onRequestGet(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const teacherId = url.searchParams.get('teacherId');
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    
    let query: D1PreparedStatement;
    
    if (user.role === 'admin' && !teacherId) {
      // 管理员查看所有频道
      if (includeDeleted) {
        query = env.DB.prepare('SELECT * FROM channels ORDER BY created_at DESC');
      } else {
        query = env.DB.prepare('SELECT * FROM channels WHERE is_deleted = 0 ORDER BY created_at DESC');
      }
    } else {
      // 教师查看自己的频道
      const targetTeacherId = teacherId || user.id;
      if (includeDeleted) {
        query = env.DB
          .prepare('SELECT * FROM channels WHERE user_id = ? ORDER BY created_at DESC')
          .bind(targetTeacherId);
      } else {
        query = env.DB
          .prepare('SELECT * FROM channels WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC')
          .bind(targetTeacherId);
      }
    }
    
    const { results } = await query.all<Channel>();
    
    return jsonResponse(results);
  } catch (error: any) {
    return errorResponse(error.message || '获取频道列表失败', 500);
  }
}

// ============================================
// POST /api/channels - 创建新频道
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    
    // 只有教师和管理员可以创建频道
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      name: string;
    };
    
    if (!body.name) {
      return errorResponse('缺少频道名称', 400);
    }
    
    // 生成频道 ID
    const channelId = `channel-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // 插入频道
    await env.DB
      .prepare(`
        INSERT INTO channels (id, user_id, name, created_at)
        VALUES (?, ?, ?, ?)
      `)
      .bind(
        channelId,
        user.id,
        body.name,
        Date.now()
      )
      .run();
    
    return jsonResponse({ 
      id: channelId, 
      user_id: user.id,
      name: body.name,
      created_at: Date.now()
    }, 201);
  } catch (error: any) {
    return errorResponse(error.message || '创建频道失败', 500);
  }
}

// ============================================
// PUT /api/channels/:id - 更新频道信息
// ============================================
export async function onRequestPut(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/channels/');
    const channelId = pathParts[1]?.split('?')[0];
    
    if (!channelId) {
      return errorResponse('缺少频道 ID', 400);
    }
    
    // 查询频道
    const channel = await env.DB
      .prepare('SELECT * FROM channels WHERE id = ? AND is_deleted = 0')
      .bind(channelId)
      .first<Channel>();
    
    if (!channel) {
      return errorResponse('频道不存在', 404);
    }
    
    // 权限检查
    if (user.role !== 'admin' && channel.user_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      name?: string;
    };
    
    if (!body.name) {
      return errorResponse('没有要更新的字段', 400);
    }
    
    await env.DB
      .prepare('UPDATE channels SET name = ? WHERE id = ?')
      .bind(body.name, channelId)
      .run();
    
    return jsonResponse({ success: true, message: '频道已更新' });
  } catch (error: any) {
    return errorResponse(error.message || '更新频道失败', 500);
  }
}

// ============================================
// DELETE /api/channels/:id - 删除频道（软删除）
// ============================================
export async function onRequestDelete(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/channels/');
    const channelId = pathParts[1]?.split('?')[0];
    
    if (!channelId) {
      return errorResponse('缺少频道 ID', 400);
    }
    
    // 查询频道
    const channel = await env.DB
      .prepare('SELECT * FROM channels WHERE id = ? AND is_deleted = 0')
      .bind(channelId)
      .first<Channel>();
    
    if (!channel) {
      return errorResponse('频道不存在', 404);
    }
    
    // 权限检查
    if (user.role !== 'admin' && channel.user_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    // 软删除频道
    await env.DB
      .prepare('UPDATE channels SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?')
      .bind(Date.now(), user.id, channelId)
      .run();
    
    return jsonResponse({ success: true, message: '频道已删除' });
  } catch (error: any) {
    return errorResponse(error.message || '删除频道失败', 500);
  }
}
