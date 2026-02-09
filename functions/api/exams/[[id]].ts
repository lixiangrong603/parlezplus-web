// 考试系统 API (试卷和考试会话管理)

import type { Env, ExamPaper, ExamSession } from '../../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../../utils';

// ============================================
// GET /api/exams/papers - 获取试卷列表
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
    const classId = url.searchParams.get('classId');
    
    let query: D1PreparedStatement;
    
    if (user.role === 'admin' && !teacherId) {
      // 管理员查看所有试卷
      query = env.DB
        .prepare('SELECT * FROM exam_papers WHERE is_deleted = 0 ORDER BY created_at DESC');
    } else if (user.role === 'teacher' || teacherId) {
      // 教师查看自己的试卷
      const targetTeacherId = teacherId || user.id;
      query = env.DB
        .prepare('SELECT * FROM exam_papers WHERE teacher_id = ? AND is_deleted = 0 ORDER BY created_at DESC')
        .bind(targetTeacherId);
    } else if (user.role === 'student' && classId) {
      // 学生查看分配给自己班级的试卷
      query = env.DB
        .prepare(`SELECT * FROM exam_papers WHERE is_deleted = 0 AND assigned_class_ids LIKE ? ORDER BY created_at DESC`)
        .bind(`%"${classId}"%`);
    } else {
      return errorResponse('无权限或缺少参数', 403);
    }
    
    const { results } = await query.all<ExamPaper>();
    
    // 解析 JSON 字段
    const papersWithParsedJSON = results.map(paper => ({
      ...paper,
      sections: JSON.parse(paper.sections || '[]'),
      assigned_class_ids: JSON.parse(paper.assigned_class_ids || '[]'),
      assigned_class_deadlines: JSON.parse(paper.assigned_class_deadlines || '{}'),
      exam_taker_settings: paper.exam_taker_settings ? JSON.parse(paper.exam_taker_settings) : null,
    }));
    
    return jsonResponse(papersWithParsedJSON);
  } catch (error: any) {
    return errorResponse(error.message || '获取试卷列表失败', 500);
  }
}

// ============================================
// POST /api/exams/papers - 创建试卷
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    
    // 只有教师和管理员可以创建试卷
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      title: string;
      sections: any[];
      total_score: number;
      assigned_class_ids?: string[];
      assigned_class_deadlines?: Record<string, number>;
      exam_taker_settings?: any;
    };
    
    if (!body.title || !body.sections || body.total_score === undefined) {
      return errorResponse('缺少必填字段', 400);
    }
    
    // 生成试卷 ID
    const examId = `exam-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // 插入试卷
    await env.DB
      .prepare(`
        INSERT INTO exam_papers (
          id, teacher_id, title, sections, total_score,
          assigned_class_ids, assigned_class_deadlines, exam_taker_settings, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        examId,
        user.id,
        body.title,
        JSON.stringify(body.sections),
        body.total_score,
        JSON.stringify(body.assigned_class_ids || []),
        JSON.stringify(body.assigned_class_deadlines || {}),
        body.exam_taker_settings ? JSON.stringify(body.exam_taker_settings) : null,
        Date.now()
      )
      .run();
    
    return jsonResponse({ 
      id: examId,
      title: body.title,
      total_score: body.total_score
    }, 201);
  } catch (error: any) {
    return errorResponse(error.message || '创建试卷失败', 500);
  }
}

// ============================================
// PUT /api/exams/papers/:id - 更新试卷
// ============================================
export async function onRequestPut_paper(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/exams/papers/');
    const examId = pathParts[1]?.split('?')[0];
    
    if (!examId) {
      return errorResponse('缺少试卷 ID', 400);
    }
    
    // 查询试卷
    const exam = await env.DB
      .prepare('SELECT * FROM exam_papers WHERE id = ? AND is_deleted = 0')
      .bind(examId)
      .first<ExamPaper>();
    
    if (!exam) {
      return errorResponse('试卷不存在', 404);
    }
    
    // 权限检查
    if (user.role !== 'admin' && exam.teacher_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      title?: string;
      sections?: any[];
      total_score?: number;
      assigned_class_ids?: string[];
      assigned_class_deadlines?: Record<string, number>;
      exam_taker_settings?: any;
    };
    
    // 构建更新语句
    const updates: string[] = [];
    const values: any[] = [];
    
    if (body.title !== undefined) {
      updates.push('title = ?');
      values.push(body.title);
    }
    
    if (body.sections !== undefined) {
      updates.push('sections = ?');
      values.push(JSON.stringify(body.sections));
    }
    
    if (body.total_score !== undefined) {
      updates.push('total_score = ?');
      values.push(body.total_score);
    }
    
    if (body.assigned_class_ids !== undefined) {
      updates.push('assigned_class_ids = ?');
      values.push(JSON.stringify(body.assigned_class_ids));
    }
    
    if (body.assigned_class_deadlines !== undefined) {
      updates.push('assigned_class_deadlines = ?');
      values.push(JSON.stringify(body.assigned_class_deadlines));
    }
    
    if (body.exam_taker_settings !== undefined) {
      updates.push('exam_taker_settings = ?');
      values.push(JSON.stringify(body.exam_taker_settings));
    }
    
    if (updates.length === 0) {
      return errorResponse('没有要更新的字段', 400);
    }
    
    values.push(examId);
    
    await env.DB
      .prepare(`UPDATE exam_papers SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
    
    return jsonResponse({ success: true, message: '试卷已更新' });
  } catch (error: any) {
    return errorResponse(error.message || '更新试卷失败', 500);
  }
}

// ============================================
// DELETE /api/exams/papers/:id - 删除试卷
// ============================================
export async function onRequestDelete_paper(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/exams/papers/');
    const examId = pathParts[1]?.split('?')[0];
    
    if (!examId) {
      return errorResponse('缺少试卷 ID', 400);
    }
    
    // 查询试卷
    const exam = await env.DB
      .prepare('SELECT * FROM exam_papers WHERE id = ? AND is_deleted = 0')
      .bind(examId)
      .first<ExamPaper>();
    
    if (!exam) {
      return errorResponse('试卷不存在', 404);
    }
    
    // 权限检查
    if (user.role !== 'admin' && exam.teacher_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    // 软删除试卷
    await env.DB
      .prepare('UPDATE exam_papers SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?')
      .bind(Date.now(), user.id, examId)
      .run();
    
    return jsonResponse({ success: true, message: '试卷已删除' });
  } catch (error: any) {
    return errorResponse(error.message || '删除试卷失败', 500);
  }
}

// ============================================
// GET /api/exams/sessions - 获取考试会话列表
// ============================================
export async function onRequestGet_sessions(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const examId = url.searchParams.get('examId');
    const studentId = url.searchParams.get('studentId');
    
    let query: D1PreparedStatement;
    
    if (user.role === 'student') {
      // 学生查看自己的考试会话
      query = env.DB
        .prepare('SELECT * FROM exam_sessions WHERE student_id = ? AND is_deleted = 0 ORDER BY start_time DESC')
        .bind(user.id);
    } else if (user.role === 'teacher' || user.role === 'admin') {
      // 教师/管理员查看考试会话
      if (examId) {
        query = env.DB
          .prepare('SELECT * FROM exam_sessions WHERE exam_paper_id = ? AND is_deleted = 0 ORDER BY start_time DESC')
          .bind(examId);
      } else if (studentId) {
        query = env.DB
          .prepare('SELECT * FROM exam_sessions WHERE student_id = ? AND is_deleted = 0 ORDER BY start_time DESC')
          .bind(studentId);
      } else {
        query = env.DB
          .prepare('SELECT * FROM exam_sessions WHERE is_deleted = 0 ORDER BY start_time DESC LIMIT 100');
      }
    } else {
      return errorResponse('无权限', 403);
    }
    
    const { results } = await query.all<ExamSession>();
    
    // 解析 JSON 字段
    const sessionsWithParsedJSON = results.map(session => ({
      ...session,
      answers: JSON.parse(session.answers || '{}'),
      item_scores: session.item_scores ? JSON.parse(session.item_scores) : null,
    }));
    
    return jsonResponse(sessionsWithParsedJSON);
  } catch (error: any) {
    return errorResponse(error.message || '获取考试会话失败', 500);
  }
}

// ============================================
// POST /api/exams/sessions - 创建考试会话（学生开始考试）
// ============================================
export async function onRequestPost_session(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    
    if (!user || user.role !== 'student') {
      return errorResponse('只有学生可以开始考试', 403);
    }
    
    const body = await request.json() as {
      exam_paper_id: string;
      exam_title: string;
      total_score: number;
    };
    
    if (!body.exam_paper_id || !body.exam_title || body.total_score === undefined) {
      return errorResponse('缺少必填字段', 400);
    }
    
    // 生成会话 ID
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // 插入考试会话
    await env.DB
      .prepare(`
        INSERT INTO exam_sessions (
          id, exam_paper_id, exam_title, student_id, student_name,
          answers, start_time, elapsed_time, total_score, is_submitted
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        sessionId,
        body.exam_paper_id,
        body.exam_title,
        user.id,
        user.name,
        '{}', // 空答案
        Date.now(),
        0, // elapsed_time
        body.total_score,
        0 // is_submitted
      )
      .run();
    
    return jsonResponse({ 
      id: sessionId,
      start_time: Date.now()
    }, 201);
  } catch (error: any) {
    return errorResponse(error.message || '创建考试会话失败', 500);
  }
}

// ============================================
// PUT /api/exams/sessions/:id - 更新考试会话（保存答案或提交）
// ============================================
export async function onRequestPut_session(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/exams/sessions/');
    const sessionId = pathParts[1]?.split('?')[0];
    
    if (!sessionId) {
      return errorResponse('缺少会话 ID', 400);
    }
    
    // 查询会话
    const session = await env.DB
      .prepare('SELECT * FROM exam_sessions WHERE id = ? AND is_deleted = 0')
      .bind(sessionId)
      .first<ExamSession>();
    
    if (!session) {
      return errorResponse('考试会话不存在', 404);
    }
    
    // 权限检查：学生只能更新自己的会话，教师可以批改
    if (user.role === 'student' && session.student_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      answers?: Record<string, any>;
      elapsed_time?: number;
      is_submitted?: boolean;
      submit_time?: number;
      score?: number;
      teacher_feedback?: string;
      manual_score?: number;
      item_scores?: any;
      status?: string;
    };
    
    // 构建更新语句
    const updates: string[] = [];
    const values: any[] = [];
    
    if (body.answers !== undefined) {
      updates.push('answers = ?');
      values.push(JSON.stringify(body.answers));
    }
    
    if (body.elapsed_time !== undefined) {
      updates.push('elapsed_time = ?');
      values.push(body.elapsed_time);
    }
    
    if (body.is_submitted !== undefined) {
      updates.push('is_submitted = ?');
      values.push(body.is_submitted ? 1 : 0);
    }
    
    if (body.submit_time !== undefined) {
      updates.push('submit_time = ?');
      values.push(body.submit_time);
    }
    
    if (body.score !== undefined) {
      updates.push('score = ?');
      values.push(body.score);
    }
    
    // 教师批改字段
    if ((user.role === 'teacher' || user.role === 'admin')) {
      if (body.teacher_feedback !== undefined) {
        updates.push('teacher_feedback = ?');
        values.push(body.teacher_feedback);
      }
      
      if (body.manual_score !== undefined) {
        updates.push('manual_score = ?');
        values.push(body.manual_score);
      }
      
      if (body.item_scores !== undefined) {
        updates.push('item_scores = ?');
        values.push(JSON.stringify(body.item_scores));
      }
      
      if (body.status !== undefined) {
        updates.push('status = ?');
        values.push(body.status);
      }
      
      updates.push('graded_by = ?');
      updates.push('graded_at = ?');
      values.push(user.id);
      values.push(Date.now());
    }
    
    if (updates.length === 0) {
      return errorResponse('没有要更新的字段', 400);
    }
    
    values.push(sessionId);
    
    await env.DB
      .prepare(`UPDATE exam_sessions SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
    
    return jsonResponse({ success: true, message: '考试会话已更新' });
  } catch (error: any) {
    return errorResponse(error.message || '更新考试会话失败', 500);
  }
}
