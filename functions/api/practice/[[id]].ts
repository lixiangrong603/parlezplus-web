// 练习数据管理 API

import type { Env, PracticeData, Submission } from '../../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../../utils';

// ============================================
// GET /api/practice - 获取练习数据
// ============================================
export async function onRequestGet(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const resourceId = url.searchParams.get('resourceId');
    
    let query: D1PreparedStatement;
    
    if (user.role === 'student') {
      // 学生查看自己的练习数据
      if (resourceId) {
        query = env.DB
          .prepare('SELECT * FROM student_practice_data WHERE user_id = ? AND resource_id = ? AND is_deleted = 0')
          .bind(user.id, resourceId);
      } else {
        query = env.DB
          .prepare('SELECT * FROM student_practice_data WHERE user_id = ? AND is_deleted = 0 ORDER BY last_updated DESC')
          .bind(user.id);
      }
    } else if (user.role === 'teacher' || user.role === 'admin') {
      // 教师查看学生的练习数据
      if (userId && resourceId) {
        query = env.DB
          .prepare('SELECT * FROM student_practice_data WHERE user_id = ? AND resource_id = ? AND is_deleted = 0')
          .bind(userId, resourceId);
      } else if (resourceId) {
        query = env.DB
          .prepare('SELECT * FROM student_practice_data WHERE resource_id = ? AND is_deleted = 0 ORDER BY last_updated DESC')
          .bind(resourceId);
      } else if (userId) {
        query = env.DB
          .prepare('SELECT * FROM student_practice_data WHERE user_id = ? AND is_deleted = 0 ORDER BY last_updated DESC')
          .bind(userId);
      } else {
        return errorResponse('需要提供 userId 或 resourceId', 400);
      }
    } else {
      return errorResponse('无权限', 403);
    }
    
    const { results } = await query.all<PracticeData>();
    
    // 解析 JSON 字段
    const practiceWithParsedJSON = results.map(practice => ({
      ...practice,
      quiz_answers: practice.quiz_answers ? JSON.parse(practice.quiz_answers) : null,
      quiz_score: practice.quiz_score ? JSON.parse(practice.quiz_score) : null,
      cloze_answers: practice.cloze_answers ? JSON.parse(practice.cloze_answers) : null,
      cloze_score: practice.cloze_score ? JSON.parse(practice.cloze_score) : null,
      segment_recordings: JSON.parse(practice.segment_recordings || '{}'),
      segment_scores: JSON.parse(practice.segment_scores || '{}'),
      overall_score: practice.overall_score ? JSON.parse(practice.overall_score) : null,
    }));
    
    return jsonResponse(practiceWithParsedJSON);
  } catch (error: any) {
    return errorResponse(error.message || '获取练习数据失败', 500);
  }
}

// ============================================
// POST /api/practice - 创建或更新练习数据
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    
    if (!user || user.role !== 'student') {
      return errorResponse('只有学生可以创建练习数据', 403);
    }
    
    const body = await request.json() as {
      resource_id: string;
      quiz_answers?: any;
      quiz_score?: any;
      cloze_answers?: any;
      cloze_score?: any;
      segment_recordings?: Record<string, string>;
      segment_scores?: Record<string, any>;
      full_recording_r2_key?: string;
      overall_score?: any;
    };
    
    if (!body.resource_id) {
      return errorResponse('缺少 resource_id', 400);
    }
    
    // 检查是否已存在
    const existing = await env.DB
      .prepare('SELECT id FROM student_practice_data WHERE user_id = ? AND resource_id = ?')
      .bind(user.id, body.resource_id)
      .first<{ id: string }>();
    
    if (existing) {
      // 更新现有记录
      const updates: string[] = [];
      const values: any[] = [];
      
      if (body.quiz_answers !== undefined) {
        updates.push('quiz_answers = ?');
        values.push(JSON.stringify(body.quiz_answers));
      }
      
      if (body.quiz_score !== undefined) {
        updates.push('quiz_score = ?');
        values.push(JSON.stringify(body.quiz_score));
      }
      
      if (body.cloze_answers !== undefined) {
        updates.push('cloze_answers = ?');
        values.push(JSON.stringify(body.cloze_answers));
      }
      
      if (body.cloze_score !== undefined) {
        updates.push('cloze_score = ?');
        values.push(JSON.stringify(body.cloze_score));
      }
      
      if (body.segment_recordings !== undefined) {
        updates.push('segment_recordings = ?');
        values.push(JSON.stringify(body.segment_recordings));
      }
      
      if (body.segment_scores !== undefined) {
        updates.push('segment_scores = ?');
        values.push(JSON.stringify(body.segment_scores));
      }
      
      if (body.full_recording_r2_key !== undefined) {
        updates.push('full_recording_r2_key = ?');
        values.push(body.full_recording_r2_key);
      }
      
      if (body.overall_score !== undefined) {
        updates.push('overall_score = ?');
        values.push(JSON.stringify(body.overall_score));
      }
      
      updates.push('last_updated = ?');
      values.push(Date.now());
      
      values.push(existing.id);
      
      await env.DB
        .prepare(`UPDATE student_practice_data SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();
      
      return jsonResponse({ id: existing.id, updated: true });
    } else {
      // 创建新记录
      const practiceId = `practice-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      await env.DB
        .prepare(`
          INSERT INTO student_practice_data (
            id, user_id, resource_id,
            quiz_answers, quiz_score, cloze_answers, cloze_score,
            segment_recordings, segment_scores, full_recording_r2_key, overall_score,
            last_updated
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          practiceId,
          user.id,
          body.resource_id,
          body.quiz_answers ? JSON.stringify(body.quiz_answers) : null,
          body.quiz_score ? JSON.stringify(body.quiz_score) : null,
          body.cloze_answers ? JSON.stringify(body.cloze_answers) : null,
          body.cloze_score ? JSON.stringify(body.cloze_score) : null,
          JSON.stringify(body.segment_recordings || {}),
          JSON.stringify(body.segment_scores || {}),
          body.full_recording_r2_key || null,
          body.overall_score ? JSON.stringify(body.overall_score) : null,
          Date.now()
        )
        .run();
      
      return jsonResponse({ id: practiceId, created: true }, 201);
    }
  } catch (error: any) {
    return errorResponse(error.message || '保存练习数据失败', 500);
  }
}

// ============================================
// DELETE /api/practice/:id - 删除练习数据（软删除）
// ============================================
export async function onRequestDelete(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/practice/');
    const practiceId = pathParts[1]?.split('?')[0];
    
    if (!practiceId) {
      return errorResponse('缺少练习数据 ID', 400);
    }
    
    // 查询练习数据
    const practice = await env.DB
      .prepare('SELECT * FROM student_practice_data WHERE id = ? AND is_deleted = 0')
      .bind(practiceId)
      .first<PracticeData>();
    
    if (!practice) {
      return errorResponse('练习数据不存在', 404);
    }
    
    // 权限检查：学生只能删除自己的数据，教师可以删除任何学生的数据
    if (user.role === 'student' && practice.user_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    // 软删除
    await env.DB
      .prepare('UPDATE student_practice_data SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?')
      .bind(Date.now(), user.id, practiceId)
      .run();
    
    return jsonResponse({ success: true, message: '练习数据已删除' });
  } catch (error: any) {
    return errorResponse(error.message || '删除练习数据失败', 500);
  }
}

// ============================================
// GET /api/practice/submissions - 获取作业提交记录
// ============================================
export async function onRequestGet_submissions(context: any): Promise<Response> {
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
    
    let query: string;
    const params: any[] = [];
    
    query = 'SELECT * FROM submissions WHERE is_deleted = 0';
    
    if (user.role === 'student') {
      // 学生查看自己的提交
      query += ' AND student_id = ?';
      params.push(user.id);
    } else if (user.role === 'teacher' || user.role === 'admin') {
      // 教师查看学生提交
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
    return errorResponse(error.message || '获取提交记录失败', 500);
  }
}

// ============================================
// POST /api/practice/submissions - 创建作业提交
// ============================================
export async function onRequestPost_submission(context: any): Promise<Response> {
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
    
    // 生成提交 ID
    const submissionId = `submission-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // 插入提交记录
    await env.DB
      .prepare(`
        INSERT INTO submissions (
          id, student_id, resource_id, audio_r2_key,
          ai_score, ai_segment_evals, quiz_result, cloze_result,
          status, submitted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        'pending_review',
        Date.now()
      )
      .run();
    
    return jsonResponse({ id: submissionId, status: 'pending_review' }, 201);
  } catch (error: any) {
    return errorResponse(error.message || '创建提交失败', 500);
  }
}

// ============================================
// PUT /api/practice/submissions/:id - 更新提交（教师批改）
// ============================================
export async function onRequestPut_submission(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return errorResponse('只有教师可以批改作业', 403);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/practice/submissions/');
    const submissionId = pathParts[1]?.split('?')[0];
    
    if (!submissionId) {
      return errorResponse('缺少提交 ID', 400);
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
    
    return jsonResponse({ success: true, message: '提交已更新' });
  } catch (error: any) {
    return errorResponse(error.message || '更新提交失败', 500);
  }
}
