// 考试系统 API (试卷和考试会话管理)

import type { Env, ExamPaper, ExamSession } from '../../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../../utils';

// ============================================
// GET /api/exams/papers - 获取试卷列表
// ============================================
async function handleGetPapers(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const teacherId = url.searchParams.get('teacherId');
    const classId = url.searchParams.get('classId');
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    
    let query: D1PreparedStatement;
    
    if (user.role === 'admin' && !teacherId) {
      // 管理员查看所有试卷
      if (includeDeleted) {
        query = env.DB.prepare('SELECT * FROM exam_papers ORDER BY created_at DESC');
      } else {
        query = env.DB.prepare('SELECT * FROM exam_papers WHERE is_deleted = 0 ORDER BY created_at DESC');
      }
    } else if (user.role === 'teacher' || teacherId) {
      // 教师查看自己的试卷
      const targetTeacherId = teacherId || user.id;
      if (includeDeleted) {
        query = env.DB
          .prepare('SELECT * FROM exam_papers WHERE teacher_id = ? ORDER BY created_at DESC')
          .bind(targetTeacherId);
      } else {
        query = env.DB
          .prepare('SELECT * FROM exam_papers WHERE teacher_id = ? AND is_deleted = 0 ORDER BY created_at DESC')
          .bind(targetTeacherId);
      }
    } else if (user.role === 'student') {
      // 学生查看分配给自己班级的试卷
      // 优先主要参数 classId，否则回退到 user.class_id
      const targetClassId = classId || user.class_id;
      
      if (targetClassId) {
        query = env.DB
          .prepare(`SELECT * FROM exam_papers WHERE is_deleted = 0 AND assigned_class_ids LIKE ? ORDER BY created_at DESC`)
          .bind(`%"${targetClassId}"%`);
      } else {
        // 如果学生没有班级信息，返回空列表
        return jsonResponse([]);
      }
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
async function handleCreatePaper(context: any): Promise<Response> {
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
async function handleUpdatePaper(context: any, examId: string): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    // URL parsing moved to router
    
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
async function handleDeletePaper(context: any, examId: string): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
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
// DELETE /api/exams/sessions/:id - 删除考试会话
// ============================================
async function handleDeleteSession(context: any, sessionId: string): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
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
    
    // 权限检查：教师可以删除学生的会话，学生不能删除
    if (user.role === 'student') {
      return errorResponse('学生无权删除考试会话', 403);
    }
    
    // 软删除会话
    await env.DB
      .prepare('UPDATE exam_sessions SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?')
      .bind(Date.now(), user.id, sessionId)
      .run();
    
    return jsonResponse({ success: true, message: '考试会话已删除' });
  } catch (error: any) {
    return errorResponse(error.message || '删除考试会话失败', 500);
  }
}

// ============================================
// GET /api/exams/sessions/:id - 获取单个考试会话
// ============================================
async function handleGetSingleSession(context: any, sessionId: string): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
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
    
    // 权限检查
    if (user.role === 'student' && session.student_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    // 解析 JSON 字段
    const sessionWithParsedJSON = {
      ...session,
      answers: JSON.parse(session.answers || '{}'),
      item_scores: session.item_scores ? JSON.parse(session.item_scores) : null,
    };
    
    return jsonResponse(sessionWithParsedJSON);
  } catch (error: any) {
    return errorResponse(error.message || '获取考试会话失败', 500);
  }
}

// ============================================
// GET /api/exams/sessions - 获取考试会话列表
// ============================================
async function handleGetSessions(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const examId = url.searchParams.get('examId');
    const studentId = url.searchParams.get('studentId');
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    
    let query: D1PreparedStatement;
    
    if (user.role === 'student') {
      // 学生查看自己的考试会话
      if (includeDeleted) {
        query = env.DB
          .prepare('SELECT * FROM exam_sessions WHERE student_id = ? ORDER BY start_time DESC')
          .bind(user.id);
      } else {
        query = env.DB
          .prepare('SELECT * FROM exam_sessions WHERE student_id = ? AND is_deleted = 0 ORDER BY start_time DESC')
          .bind(user.id);
      }
    } else if (user.role === 'teacher' || user.role === 'admin') {
      // 教师/管理员查看考试会话
      if (examId) {
        if (includeDeleted) {
          query = env.DB
            .prepare('SELECT * FROM exam_sessions WHERE exam_paper_id = ? ORDER BY start_time DESC')
            .bind(examId);
        } else {
          query = env.DB
            .prepare('SELECT * FROM exam_sessions WHERE exam_paper_id = ? AND is_deleted = 0 ORDER BY start_time DESC')
            .bind(examId);
        }
      } else if (studentId) {
        if (includeDeleted) {
          query = env.DB
            .prepare('SELECT * FROM exam_sessions WHERE student_id = ? ORDER BY start_time DESC')
            .bind(studentId);
        } else {
          query = env.DB
            .prepare('SELECT * FROM exam_sessions WHERE student_id = ? AND is_deleted = 0 ORDER BY start_time DESC')
            .bind(studentId);
        }
      } else {
        if (includeDeleted) {
          query = env.DB
            .prepare('SELECT * FROM exam_sessions ORDER BY start_time DESC LIMIT 100');
        } else {
          query = env.DB
            .prepare('SELECT * FROM exam_sessions WHERE is_deleted = 0 ORDER BY start_time DESC LIMIT 100');
        }
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
async function handleCreateSession(context: any): Promise<Response> {
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
    
    // 生成会话 ID (Use stable ID)
    const sessionId = `session_${body.exam_paper_id}_${user.id}`;
    
    // Check existing
    const existing = await env.DB.prepare('SELECT id FROM exam_sessions WHERE id = ?').bind(sessionId).first();
    if (existing) {
       return jsonResponse({ id: sessionId, start_time: Date.now() }, 200); // Return existing session info implicitly or just success
    }
    
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
async function handleUpdateSession(context: any, sessionId: string): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    // URL parsing moved to router
    
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

// ============================================
// Main Handlers (Router)
// ============================================

export async function onRequestGet(context: any): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(p => p); 
  // e.g. ['api', 'exams'], ['api', 'exams', 'sessions'], ['api', 'exams', 'sessions', 'session_xxx']

  // Find where 'exams' is
  const examsIndex = pathParts.indexOf('exams');
  if (examsIndex === -1) return handleGetPapers(context); // Fallback

  const afterExams = pathParts.slice(examsIndex + 1);
  // [] -> /api/exams
  // ['papers'] -> /api/exams/papers
  // ['sessions'] -> /api/exams/sessions (list)
  // ['sessions', 'session_xxx'] -> /api/exams/sessions/session_xxx (single)

  if (afterExams.length === 0 || afterExams[0] === 'papers') {
    return handleGetPapers(context);
  }

  if (afterExams[0] === 'sessions') {
    if (afterExams.length > 1) {
      // Get single session: /api/exams/sessions/session_xxx
      return handleGetSingleSession(context, afterExams[1]);
    }
    // Get sessions list: /api/exams/sessions
    return handleGetSessions(context);
  }

  // Assume ID for paper (fallback)
  return handleGetPapers(context);
}

export async function onRequestPost(context: any): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  
  if (url.pathname.endsWith('/sessions')) {
    return handleCreateSession(context);
  }
  
  // Default to creating paper
  return handleCreatePaper(context);
}

export async function onRequestPut(context: any): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const lastPart = pathParts[pathParts.length - 1]; // ID
  const secondLastPart = pathParts[pathParts.length - 2]; 
  
  // Clean up potential trailing slash or query
  const cleanLastPart = lastPart.split('?')[0];

  if (secondLastPart === 'sessions' || cleanLastPart.startsWith('session_')) {
    return handleUpdateSession(context, cleanLastPart);
  }
  
  return handleUpdatePaper(context, cleanLastPart);
}

export async function onRequestDelete(context: any): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/');
  const lastPart = pathParts[pathParts.length - 1].split('?')[0];
  const secondLastPart = pathParts[pathParts.length - 2];
  
  // Check if deleting a session: /api/exams/sessions/session_xxx
  if (secondLastPart === 'sessions' || lastPart.startsWith('session_')) {
    return handleDeleteSession(context, lastPart);
  }
  
  // Otherwise, delete paper
  return handleDeletePaper(context, lastPart);
}
