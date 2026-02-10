// 试卷文件夹管理 API (CRUD)

import type { Env, ExamFolder } from '../../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../../utils';

// ============================================
// GET /api/exam-folders - 获取文件夹列表
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
      // 管理员查看所有文件夹
      if (includeDeleted) {
        query = env.DB.prepare('SELECT * FROM exam_folders ORDER BY created_at DESC');
      } else {
        query = env.DB.prepare('SELECT * FROM exam_folders WHERE is_deleted = 0 ORDER BY created_at DESC');
      }
    } else {
      // 教师查看自己的文件夹
      const targetTeacherId = teacherId || user.id;
      if (includeDeleted) {
        query = env.DB
          .prepare('SELECT * FROM exam_folders WHERE user_id = ? ORDER BY created_at DESC')
          .bind(targetTeacherId);
      } else {
        query = env.DB
          .prepare('SELECT * FROM exam_folders WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC')
          .bind(targetTeacherId);
      }
    }
    
    const { results } = await query.all<ExamFolder>();
    
    return jsonResponse(results);
  } catch (error: any) {
    return errorResponse(error.message || '获取文件夹列表失败', 500);
  }
}

// ============================================
// POST /api/exam-folders - 创建新文件夹
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    
    // 只有教师和管理员可以创建文件夹
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      name: string;
    };
    
    if (!body.name) {
      return errorResponse('缺少文件夹名称', 400);
    }
    
    // 生成文件夹 ID
    const folderId = `folder-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // 插入文件夹
    await env.DB
      .prepare(`
        INSERT INTO exam_folders (id, user_id, name, created_at)
        VALUES (?, ?, ?, ?)
      `)
      .bind(
        folderId,
        user.id,
        body.name,
        Date.now()
      )
      .run();
    
    return jsonResponse({ 
      id: folderId, 
      user_id: user.id,
      name: body.name,
      created_at: Date.now()
    }, 201);
  } catch (error: any) {
    return errorResponse(error.message || '创建文件夹失败', 500);
  }
}

// ============================================
// PUT /api/exam-folders/:id - 更新文件夹信息
// ============================================
export async function onRequestPut(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/exam-folders/');
    const folderId = pathParts[1]?.split('?')[0];
    
    if (!folderId) {
      return errorResponse('缺少文件夹 ID', 400);
    }
    
    // 查询文件夹
    const folder = await env.DB
      .prepare('SELECT * FROM exam_folders WHERE id = ? AND is_deleted = 0')
      .bind(folderId)
      .first<ExamFolder>();
    
    if (!folder) {
      return errorResponse('文件夹不存在', 404);
    }
    
    // 验证权限
    if (folder.user_id !== user.id && user.role !== 'admin') {
      return errorResponse('无权限修改此文件夹', 403);
    }
    
    const body = await request.json() as {
      name?: string;
    };
    
    if (!body.name) {
      return errorResponse('缺少文件夹名称', 400);
    }
    
    // 更新文件夹
    await env.DB
      .prepare('UPDATE exam_folders SET name = ? WHERE id = ?')
      .bind(body.name, folderId)
      .run();
    
    return jsonResponse({ success: true });
  } catch (error: any) {
    return errorResponse(error.message || '更新文件夹失败', 500);
  }
}

// ============================================
// DELETE /api/exam-folders/:id - 删除文件夹（软删除）
// ============================================
export async function onRequestDelete(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/exam-folders/');
    const folderId = pathParts[1]?.split('?')[0];
    
    if (!folderId) {
      return errorResponse('缺少文件夹 ID', 400);
    }
    
    // 查询文件夹
    const folder = await env.DB
      .prepare('SELECT * FROM exam_folders WHERE id = ? AND is_deleted = 0')
      .bind(folderId)
      .first<ExamFolder>();
    
    if (!folder) {
      return errorResponse('文件夹不存在', 404);
    }
    
    // 验证权限
    if (folder.user_id !== user.id && user.role !== 'admin') {
      return errorResponse('无权限删除此文件夹', 403);
    }
    
    // 软删除文件夹
    await env.DB
      .prepare('UPDATE exam_folders SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?')
      .bind(Date.now(), user.id, folderId)
      .run();
    
    // 清除该文件夹下所有试卷的 folder_id
    await env.DB
      .prepare('UPDATE exam_papers SET folder_id = NULL WHERE folder_id = ?')
      .bind(folderId)
      .run();
    
    return jsonResponse({ success: true });
  } catch (error: any) {
    return errorResponse(error.message || '删除文件夹失败', 500);
  }
}
