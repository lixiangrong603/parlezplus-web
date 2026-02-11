// 班级管理 API (CRUD)

import type { Env, Classroom } from '../../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../../utils';

// ============================================
// GET /api/classrooms - 获取班级列表
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
      // 管理员查看所有班级
      if (includeDeleted) {
        query = env.DB.prepare('SELECT * FROM classrooms ORDER BY created_at DESC');
      } else {
        query = env.DB.prepare('SELECT * FROM classrooms WHERE is_deleted = 0 ORDER BY created_at DESC');
      }
    } else if (user.role === 'teacher' || teacherId) {
      // 教师查看自己的班级
      const targetTeacherId = teacherId || user.id;
      if (includeDeleted) {
        query = env.DB
          .prepare('SELECT * FROM classrooms WHERE user_id = ? ORDER BY created_at DESC')
          .bind(targetTeacherId);
      } else {
        query = env.DB
          .prepare('SELECT * FROM classrooms WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC')
          .bind(targetTeacherId);
      }
    } else if (user.role === 'student') {
      // 学生查看自己所在的班级
      if (!user.class_id) {
        return jsonResponse([]);
      }
      query = env.DB
        .prepare('SELECT * FROM classrooms WHERE id = ? AND is_deleted = 0')
        .bind(user.class_id);
    } else {
      return errorResponse('无权限', 403);
    }
    
    const { results } = await query.all<Classroom>();
    
    // 解析学生列表 JSON
    const classroomsWithParsedStudents = results.map(classroom => ({
      ...classroom,
      students: JSON.parse(classroom.students || '[]'),
    }));
    
    return jsonResponse(classroomsWithParsedStudents);
  } catch (error: any) {
    return errorResponse(error.message || '获取班级列表失败', 500);
  }
}

// ============================================
// POST /api/classrooms - 创建新班级
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    
    // 只有教师和管理员可以创建班级
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      name: string;
      teacherId?: string; // 管理员可以为其他教师创建班级
    };
    
    if (!body.name) {
      return errorResponse('缺少班级名称', 400);
    }
    
    // 确定教师 ID
    const teacherId = (user.role === 'admin' && body.teacherId) ? body.teacherId : user.id;
    
    // 生成班级 ID
    const classroomId = `class-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // 插入班级
    await env.DB
      .prepare(`
        INSERT INTO classrooms (id, user_id, name, student_count, students, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        classroomId,
        teacherId,
        body.name,
        0,
        '[]', // 空学生列表
        Date.now()
      )
      .run();
    
    return jsonResponse({ 
      id: classroomId, 
      user_id: teacherId,
      name: body.name,
      student_count: 0,
      students: []
    }, 201);
  } catch (error: any) {
    return errorResponse(error.message || '创建班级失败', 500);
  }
}

// ============================================
// PUT /api/classrooms/:id - 更新班级信息
// ============================================
export async function onRequestPut(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    // 从 URL 获取班级 ID
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/classrooms/');
    const classroomId = pathParts[1]?.split('?')[0];
    
    if (!classroomId) {
      return errorResponse('缺少班级 ID', 400);
    }
    
    // 查询班级
    const classroom = await env.DB
      .prepare('SELECT * FROM classrooms WHERE id = ? AND is_deleted = 0')
      .bind(classroomId)
      .first<Classroom>();
    
    if (!classroom) {
      return errorResponse('班级不存在', 404);
    }
    
    // 权限检查：管理员可以修改任何班级，教师只能修改自己的班级
    if (user.role !== 'admin' && classroom.user_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      name?: string;
      students?: Array<{ id: string; name: string; avatar_r2_key?: string; userId?: string }>;
    };
    
    // 构建更新语句
    const updates: string[] = [];
    const values: any[] = [];
    
    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    
    if (body.students !== undefined) {
      updates.push('students = ?');
      updates.push('student_count = ?');
      values.push(JSON.stringify(body.students));
      values.push(body.students.length);
    }
    
    if (updates.length === 0) {
      return errorResponse('没有要更新的字段', 400);
    }
    
    values.push(classroomId);
    
    await env.DB
      .prepare(`UPDATE classrooms SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
    
    return jsonResponse({ success: true, message: '班级信息已更新' });
  } catch (error: any) {
    return errorResponse(error.message || '更新班级失败', 500);
  }
}

// ============================================
// DELETE /api/classrooms/:id - 删除班级（软删除）
// ============================================
export async function onRequestDelete(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/classrooms/');
    const classroomId = pathParts[1]?.split('?')[0];
    
    if (!classroomId) {
      return errorResponse('缺少班级 ID', 400);
    }
    
    // 查询班级
    const classroom = await env.DB
      .prepare('SELECT * FROM classrooms WHERE id = ? AND is_deleted = 0')
      .bind(classroomId)
      .first<Classroom>();
    
    if (!classroom) {
      return errorResponse('班级不存在', 404);
    }
    
    // 权限检查：管理员可以删除任何班级，教师只能删除自己的班级
    if (user.role !== 'admin' && classroom.user_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    // 软删除班级
    await env.DB
      .prepare('UPDATE classrooms SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?')
      .bind(Date.now(), user.id, classroomId)
      .run();
    
    return jsonResponse({ success: true, message: '班级已删除' });
  } catch (error: any) {
    return errorResponse(error.message || '删除班级失败', 500);
  }
}

// ============================================
// POST /api/classrooms/:id/students - 添加学生到班级
// ============================================
export async function onRequestPost_addStudents(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return errorResponse('无权限', 403);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/classrooms/');
    const classroomId = pathParts[1]?.split('/')[0];
    
    if (!classroomId) {
      return errorResponse('缺少班级 ID', 400);
    }
    
    // 查询班级
    const classroom = await env.DB
      .prepare('SELECT * FROM classrooms WHERE id = ? AND is_deleted = 0')
      .bind(classroomId)
      .first<Classroom>();
    
    if (!classroom) {
      return errorResponse('班级不存在', 404);
    }
    
    // 权限检查
    if (user.role !== 'admin' && classroom.user_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      studentIds: string[];
    };
    
    if (!body.studentIds || body.studentIds.length === 0) {
      return errorResponse('缺少学生 ID 列表', 400);
    }
    
    // 查询学生信息
    const placeholders = body.studentIds.map(() => '?').join(',');
    const students = await env.DB
      .prepare(`SELECT id, name, avatar_r2_key FROM users WHERE id IN (${placeholders}) AND role = 'student' AND is_deleted = 0`)
      .bind(...body.studentIds)
      .all();
    
    if (!students.results || students.results.length === 0) {
      return errorResponse('未找到有效的学生', 404);
    }
    
    // 解析现有学生列表
    const currentStudents = JSON.parse(classroom.students || '[]');
    const currentStudentIds = new Set(currentStudents.map((s: any) => s.userId || s.id));
    
    // 添加新学生（去重）
    const newStudents = students.results
      .filter((s: any) => !currentStudentIds.has(s.id))
      .map((s: any) => ({
        id: `student-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: s.name,
        avatar_r2_key: s.avatar_r2_key,
        userId: s.id
      }));
    
    const updatedStudents = [...currentStudents, ...newStudents];
    
    // 更新班级学生列表
    await env.DB
      .prepare('UPDATE classrooms SET students = ?, student_count = ? WHERE id = ?')
      .bind(JSON.stringify(updatedStudents), updatedStudents.length, classroomId)
      .run();
    
    // 更新学生的 class_id
    for (const studentId of body.studentIds) {
      await env.DB
        .prepare('UPDATE users SET class_id = ? WHERE id = ?')
        .bind(classroomId, studentId)
        .run();
    }
    
    return jsonResponse({ success: true, addedCount: newStudents.length });
  } catch (error: any) {
    return errorResponse(error.message || '添加学生失败', 500);
  }
}
