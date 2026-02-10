// 作业提交管理 API (CRUD)

import type { Env, Submission } from '../../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../../utils';

// ============================================
// GET /api/submissions - 获取作业提交列表
// ============================================
export async function onRequestGet(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const studentId = url.searchParams.get('studentId');
    const resourceId = url.searchParams.get('resourceId');
    const status = url.searchParams.get('status');
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    
    let query: string;
    const params: any[] = [];
    
    query = 'SELECT * FROM submissions WHERE 1=1';
    
    if (user.role === 'student') {
      // 学生只能查看自己的提交
      query += ' AND student_id = ?';
      params.push(user.id);
    } else if (user.role === 'teacher' || user.role === 'admin') {
      // 教师/管理员可以按条件筛选
      if (studentId) {
        query += ' AND student_id = ?';
        params.push(studentId);
      }
      if (resourceId) {
        query += ' AND resource_id = ?';
        params.push(resourceId);
      }
      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }
    }
    
    if (!includeDeleted) {
      query += ' AND is_deleted = 0';
    }
    
    query += ' ORDER BY submitted_at DESC';
    
    const { results } = await env.DB
      .prepare(query)
      .bind(...params)
      .all<Submission>();
    
    // 解析 JSON 字段
    const submissionsWithParsedJSON = results.map(sub => ({
      ...sub,
      ai_score: sub.ai_score ? JSON.parse(sub.ai_score) : null,
      ai_segment_evals: sub.ai_segment_evals ? JSON.parse(sub.ai_segment_evals) : null,
      quiz_result: sub.quiz_result ? JSON.parse(sub.quiz_result) : null,
      cloze_result: sub.cloze_result ? JSON.parse(sub.cloze_result) : null,
    }));
    
    return jsonResponse(submissionsWithParsedJSON);
  } catch (error: any) {
    return errorResponse(error.message || '获取提交列表失败', 500);
  }
}

// ============================================
// POST /api/submissions - 提交作业
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    
    if (!user || user.role !== 'student') {
      return errorResponse('只有学生可以提交作业', 403);
    }
    
    const body = await request.json() as {
      resource_id: string;
      audio_r2_key: string;
      ai_score?: any;
      ai_segment_evals?: any;
      quiz_result?: any;
      cloze_result?: any;
    };
    
    if (!body.resource_id || !body.audio_r2_key) {
      return errorResponse('缺少必填字段', 400);
    }
    
    // 检查是否已存在提交
    const existing = await env.DB
      .prepare('SELECT id FROM submissions WHERE student_id = ? AND resource_id = ?')
      .bind(user.id, body.resource_id)
      .first<{ id: string }>();
    
    if (existing) {
      // 更新现有提交
      await env.DB
        .prepare(`
          UPDATE submissions SET 
            audio_r2_key = ?,
            ai_score = ?,
            ai_segment_evals = ?,
            quiz_result = ?,
            cloze_result = ?,
            status = 'pending_review',
            submitted_at = ?,
            is_deleted = 0
          WHERE id = ?
        `)
        .bind(
          body.audio_r2_key,
          body.ai_score ? JSON.stringify(body.ai_score) : null,
          body.ai_segment_evals ? JSON.stringify(body.ai_segment_evals) : null,
          body.quiz_result ? JSON.stringify(body.quiz_result) : null,
          body.cloze_result ? JSON.stringify(body.cloze_result) : null,
          Date.now(),
          existing.id
        )
        .run();
      
      return jsonResponse({ id: existing.id, updated: true });
    } else {
      // 创建新提交
      const submissionId = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      await env.DB
        .prepare(`
          INSERT INTO submissions (
            id, student_id, resource_id, audio_r2_key,
            ai_score, ai_segment_evals, quiz_result, cloze_result,
            status, submitted_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?)
        `)
        .bind(
          submissionId,
          user.id,
          body.resource_id,
          body.audio_r2_key,
          body.ai_score ? JSON.stringify(body.ai_score) : null,
          body.ai_segment_evals ? JSON.stringify(body.ai_segment_evals) : null,
          body.quiz_result ? JSON.stringify(body.quiz_result) : null,
          body.cloze_result ? JSON.stringify(body.cloze_result) : null,
          Date.now()
        )
        .run();
      
      return jsonResponse({ id: submissionId, created: true }, 201);
    }
  } catch (error: any) {
    return errorResponse(error.message || '提交作业失败', 500);
  }
}

// ============================================
// PUT /api/submissions/:id - 更新提交（教师批改）
// ============================================
export async function onRequestPut(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/submissions/');
    const submissionId = pathParts[1]?.split('?')[0];
    
    if (!submissionId) {
      return errorResponse('缺少提交 ID', 400);
    }
    
    // 查询提交
    const submission = await env.DB
      .prepare('SELECT * FROM submissions WHERE id = ? AND is_deleted = 0')
      .bind(submissionId)
      .first<Submission>();
    
    if (!submission) {
      return errorResponse('提交不存在', 404);
    }
    
    // 权限检查：只有教师和管理员可以批改
    if (user.role !== 'teacher' && user.role !== 'admin') {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      teacher_feedback?: string;
      status?: 'pending_review' | 'graded';
    };
    
    const updates: string[] = [];
    const values: any[] = [];
    
    if (body.teacher_feedback !== undefined) {
      updates.push('teacher_feedback = ?');
      values.push(body.teacher_feedback);
    }
    
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
    }
    
    if (updates.length === 0) {
      return errorResponse('没有要更新的字段', 400);
    }
    
    values.push(submissionId);
    
    await env.DB
      .prepare(`UPDATE submissions SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
    
    return jsonResponse({ success: true, message: '批改已保存' });
  } catch (error: any) {
    return errorResponse(error.message || '更新提交失败', 500);
  }
}

// ============================================
// DELETE /api/submissions/:id - 删除提交（软删除）
// ============================================
export async function onRequestDelete(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/submissions/');
    const submissionId = pathParts[1]?.split('?')[0];
    
    if (!submissionId) {
      return errorResponse('缺少提交 ID', 400);
    }
    
    // 查询提交
    const submission = await env.DB
      .prepare('SELECT * FROM submissions WHERE id = ? AND is_deleted = 0')
      .bind(submissionId)
      .first<Submission>();
    
    if (!submission) {
      return errorResponse('提交不存在', 404);
    }
    
    // 权限检查
    if (user.role === 'student' && submission.student_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    // 软删除
    await env.DB
      .prepare('UPDATE submissions SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?')
      .bind(Date.now(), user.id, submissionId)
      .run();
    
    return jsonResponse({ success: true, message: '提交已删除' });
  } catch (error: any) {
    return errorResponse(error.message || '删除提交失败', 500);
  }
}
