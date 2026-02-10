// 课程大纲管理 API (CRUD)

import type { Env, SyllabusCourse } from '../../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../../utils';

// ============================================
// GET /api/syllabus - 获取课程大纲列表
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
    
    let query: string;
    const params: any[] = [];
    
    query = 'SELECT * FROM syllabus_courses WHERE 1=1';
    
    // 权限过滤
    if (user.role === 'teacher') {
      query += ' AND user_id = ?';
      params.push(user.id);
    } else if (user.role === 'admin' && teacherId) {
      query += ' AND user_id = ?';
      params.push(teacherId);
    }
    
    // 删除状态过滤
    if (!includeDeleted) {
      query += ' AND is_deleted = 0';
    }
    
    query += ' ORDER BY created_at DESC';
    
    const { results } = await env.DB
      .prepare(query)
      .bind(...params)
      .all<SyllabusCourse>();
    
    // 解析 JSON 字段
    const coursesWithParsedJSON = results.map(course => ({
      ...course,
      units: JSON.parse(course.units || '[]'),
    }));
    
    return jsonResponse(coursesWithParsedJSON);
  } catch (error: any) {
    return errorResponse(error.message || '获取课程大纲失败', 500);
  }
}

// ============================================
// POST /api/syllabus - 创建课程大纲
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    
    // 只有教师和管理员可以创建课程大纲
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      name: string;
      units?: any[];
    };
    
    if (!body.name) {
      return errorResponse('缺少课程名称', 400);
    }
    
    // 生成课程 ID
    const courseId = `course-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // 插入课程
    await env.DB
      .prepare(`
        INSERT INTO syllabus_courses (id, user_id, name, units, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        courseId,
        user.id,
        body.name,
        JSON.stringify(body.units || []),
        Date.now()
      )
      .run();
    
    return jsonResponse({ 
      id: courseId,
      user_id: user.id,
      name: body.name,
      units: body.units || []
    }, 201);
  } catch (error: any) {
    return errorResponse(error.message || '创建课程大纲失败', 500);
  }
}

// ============================================
// PUT /api/syllabus/:id - 更新课程大纲
// ============================================
export async function onRequestPut(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/syllabus/');
    const courseId = pathParts[1]?.split('?')[0];
    
    if (!courseId) {
      return errorResponse('缺少课程 ID', 400);
    }
    
    // 查询课程
    const course = await env.DB
      .prepare('SELECT * FROM syllabus_courses WHERE id = ? AND is_deleted = 0')
      .bind(courseId)
      .first<SyllabusCourse>();
    
    if (!course) {
      return errorResponse('课程不存在', 404);
    }
    
    // 权限检查
    if (user.role !== 'admin' && course.user_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      name?: string;
      units?: any[];
    };
    
    // 构建更新语句
    const updates: string[] = [];
    const values: any[] = [];
    
    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    
    if (body.units !== undefined) {
      updates.push('units = ?');
      values.push(JSON.stringify(body.units));
    }
    
    if (updates.length === 0) {
      return errorResponse('没有要更新的字段', 400);
    }
    
    values.push(courseId);
    
    await env.DB
      .prepare(`UPDATE syllabus_courses SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
    
    return jsonResponse({ success: true, message: '课程大纲已更新' });
  } catch (error: any) {
    return errorResponse(error.message || '更新课程大纲失败', 500);
  }
}

// ============================================
// DELETE /api/syllabus/:id - 删除课程大纲（软删除）
// ============================================
export async function onRequestDelete(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/syllabus/');
    const courseId = pathParts[1]?.split('?')[0];
    
    if (!courseId) {
      return errorResponse('缺少课程 ID', 400);
    }
    
    // 查询课程
    const course = await env.DB
      .prepare('SELECT * FROM syllabus_courses WHERE id = ? AND is_deleted = 0')
      .bind(courseId)
      .first<SyllabusCourse>();
    
    if (!course) {
      return errorResponse('课程不存在', 404);
    }
    
    // 权限检查
    if (user.role !== 'admin' && course.user_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    // 软删除
    await env.DB
      .prepare('UPDATE syllabus_courses SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?')
      .bind(Date.now(), user.id, courseId)
      .run();
    
    return jsonResponse({ success: true, message: '课程大纲已删除' });
  } catch (error: any) {
    return errorResponse(error.message || '删除课程大纲失败', 500);
  }
}
