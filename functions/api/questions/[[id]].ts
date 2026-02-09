// 题库管理 API (CRUD)

import type { Env, Question } from '../../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../../utils';

// ============================================
// GET /api/questions - 获取题目列表
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
    const type = url.searchParams.get('type');
    const level = url.searchParams.get('level');
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    
    let query: string;
    const params: any[] = [];
    
    // 基础查询
    query = 'SELECT * FROM question_bank WHERE 1=1';
    
    // 权限过滤
    if (user.role === 'teacher') {
      query += ' AND teacher_id = ?';
      params.push(user.id);
    } else if (user.role === 'admin' && teacherId) {
      query += ' AND teacher_id = ?';
      params.push(teacherId);
    }
    
    // 类型过滤
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    // 难度过滤
    if (level) {
      query += ' AND level = ?';
      params.push(level);
    }
    
    // 删除状态过滤
    if (!includeDeleted) {
      query += ' AND is_deleted = 0';
    }
    
    query += ' ORDER BY created_at DESC';
    
    const { results } = await env.DB
      .prepare(query)
      .bind(...params)
      .all<Question>();
    
    // 解析 JSON 字段
    const questionsWithParsedJSON = results.map(q => ({
      ...q,
      options: JSON.parse(q.options || '[]'),
      knowledge_point_ids: JSON.parse(q.knowledge_point_ids || '[]'),
      tags: JSON.parse(q.tags || '[]'),
      sub_questions: q.sub_questions ? JSON.parse(q.sub_questions) : null,
    }));
    
    return jsonResponse(questionsWithParsedJSON);
  } catch (error: any) {
    return errorResponse(error.message || '获取题目列表失败', 500);
  }
}

// ============================================
// GET /api/questions/:id - 获取单个题目
// ============================================
export async function onRequestGet_single(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/questions/');
    const questionId = pathParts[1]?.split('?')[0];
    
    if (!questionId) {
      return errorResponse('缺少题目 ID', 400);
    }
    
    const question = await env.DB
      .prepare('SELECT * FROM question_bank WHERE id = ? AND is_deleted = 0')
      .bind(questionId)
      .first<Question>();
    
    if (!question) {
      return errorResponse('题目不存在', 404);
    }
    
    // 权限检查：教师只能查看自己的题目
    if (user.role === 'teacher' && question.teacher_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    // 解析 JSON 字段
    const questionWithParsedJSON = {
      ...question,
      options: JSON.parse(question.options || '[]'),
      knowledge_point_ids: JSON.parse(question.knowledge_point_ids || '[]'),
      tags: JSON.parse(question.tags || '[]'),
      sub_questions: question.sub_questions ? JSON.parse(question.sub_questions) : null,
    };
    
    return jsonResponse(questionWithParsedJSON);
  } catch (error: any) {
    return errorResponse(error.message || '获取题目失败', 500);
  }
}

// ============================================
// POST /api/questions - 创建新题目
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    
    // 只有教师和管理员可以创建题目
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      text: string;
      image_r2_key?: string;
      options: Array<{ id: string; text: string; imageUrl_r2_key?: string }>;
      correct_option_id: string;
      explanation?: string;
      type?: string;
      level?: string;
      knowledge_point_ids?: string[];
      tags?: string[];
      reading_passage?: string;
      sub_questions?: any[];
      created_by?: string;
    };
    
    // 验证必填字段
    if (!body.text || !body.options || body.options.length === 0 || !body.correct_option_id) {
      return errorResponse('缺少必填字段', 400);
    }
    
    // 生成题目 ID
    const questionId = `question-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // 插入题目
    await env.DB
      .prepare(`
        INSERT INTO question_bank (
          id, teacher_id, text, image_r2_key, options, correct_option_id,
          explanation, type, level, knowledge_point_ids, tags,
          reading_passage, sub_questions, created_at, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        questionId,
        user.id,
        body.text,
        body.image_r2_key || null,
        JSON.stringify(body.options),
        body.correct_option_id,
        body.explanation || null,
        body.type || 'multiple-choice',
        body.level || null,
        JSON.stringify(body.knowledge_point_ids || []),
        JSON.stringify(body.tags || []),
        body.reading_passage || null,
        body.sub_questions ? JSON.stringify(body.sub_questions) : null,
        Date.now(),
        body.created_by || 'manual'
      )
      .run();
    
    return jsonResponse({ 
      id: questionId,
      text: body.text,
      type: body.type || 'multiple-choice'
    }, 201);
  } catch (error: any) {
    return errorResponse(error.message || '创建题目失败', 500);
  }
}

// ============================================
// PUT /api/questions/:id - 更新题目
// ============================================
export async function onRequestPut(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/questions/');
    const questionId = pathParts[1]?.split('?')[0];
    
    if (!questionId) {
      return errorResponse('缺少题目 ID', 400);
    }
    
    // 查询题目
    const question = await env.DB
      .prepare('SELECT * FROM question_bank WHERE id = ? AND is_deleted = 0')
      .bind(questionId)
      .first<Question>();
    
    if (!question) {
      return errorResponse('题目不存在', 404);
    }
    
    // 权限检查：管理员可以修改任何题目，教师只能修改自己的题目
    if (user.role !== 'admin' && question.teacher_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      text?: string;
      image_r2_key?: string;
      options?: Array<{ id: string; text: string; imageUrl_r2_key?: string }>;
      correct_option_id?: string;
      explanation?: string;
      type?: string;
      level?: string;
      knowledge_point_ids?: string[];
      tags?: string[];
      reading_passage?: string;
      sub_questions?: any[];
    };
    
    // 构建更新语句
    const updates: string[] = [];
    const values: any[] = [];
    
    if (body.text !== undefined) {
      updates.push('text = ?');
      values.push(body.text);
    }
    
    if (body.image_r2_key !== undefined) {
      updates.push('image_r2_key = ?');
      values.push(body.image_r2_key);
    }
    
    if (body.options !== undefined) {
      updates.push('options = ?');
      values.push(JSON.stringify(body.options));
    }
    
    if (body.correct_option_id !== undefined) {
      updates.push('correct_option_id = ?');
      values.push(body.correct_option_id);
    }
    
    if (body.explanation !== undefined) {
      updates.push('explanation = ?');
      values.push(body.explanation);
    }
    
    if (body.type !== undefined) {
      updates.push('type = ?');
      values.push(body.type);
    }
    
    if (body.level !== undefined) {
      updates.push('level = ?');
      values.push(body.level);
    }
    
    if (body.knowledge_point_ids !== undefined) {
      updates.push('knowledge_point_ids = ?');
      values.push(JSON.stringify(body.knowledge_point_ids));
    }
    
    if (body.tags !== undefined) {
      updates.push('tags = ?');
      values.push(JSON.stringify(body.tags));
    }
    
    if (body.reading_passage !== undefined) {
      updates.push('reading_passage = ?');
      values.push(body.reading_passage);
    }
    
    if (body.sub_questions !== undefined) {
      updates.push('sub_questions = ?');
      values.push(body.sub_questions ? JSON.stringify(body.sub_questions) : null);
    }
    
    if (updates.length === 0) {
      return errorResponse('没有要更新的字段', 400);
    }
    
    values.push(questionId);
    
    await env.DB
      .prepare(`UPDATE question_bank SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
    
    return jsonResponse({ success: true, message: '题目已更新' });
  } catch (error: any) {
    return errorResponse(error.message || '更新题目失败', 500);
  }
}

// ============================================
// DELETE /api/questions/:id - 删除题目（软删除）
// ============================================
export async function onRequestDelete(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/api/questions/');
    const questionId = pathParts[1]?.split('?')[0];
    
    if (!questionId) {
      return errorResponse('缺少题目 ID', 400);
    }
    
    // 查询题目
    const question = await env.DB
      .prepare('SELECT * FROM question_bank WHERE id = ? AND is_deleted = 0')
      .bind(questionId)
      .first<Question>();
    
    if (!question) {
      return errorResponse('题目不存在', 404);
    }
    
    // 权限检查：管理员可以删除任何题目，教师只能删除自己的题目
    if (user.role !== 'admin' && question.teacher_id !== user.id) {
      return errorResponse('无权限', 403);
    }
    
    // 软删除题目
    await env.DB
      .prepare('UPDATE question_bank SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?')
      .bind(Date.now(), user.id, questionId)
      .run();
    
    return jsonResponse({ success: true, message: '题目已删除' });
  } catch (error: any) {
    return errorResponse(error.message || '删除题目失败', 500);
  }
}

// ============================================
// POST /api/questions/batch - 批量创建题目
// ============================================
export async function onRequestPost_batch(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return errorResponse('无权限', 403);
    }
    
    const body = await request.json() as {
      questions: Array<{
        text: string;
        options: Array<{ id: string; text: string }>;
        correct_option_id: string;
        type?: string;
        level?: string;
        tags?: string[];
      }>;
    };
    
    if (!body.questions || body.questions.length === 0) {
      return errorResponse('缺少题目列表', 400);
    }
    
    const createdIds: string[] = [];
    
    // 批量插入
    for (const q of body.questions) {
      if (!q.text || !q.options || !q.correct_option_id) {
        continue; // 跳过无效题目
      }
      
      const questionId = `question-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      await env.DB
        .prepare(`
          INSERT INTO question_bank (
            id, teacher_id, text, options, correct_option_id,
            type, level, tags, created_at, created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          questionId,
          user.id,
          q.text,
          JSON.stringify(q.options),
          q.correct_option_id,
          q.type || 'multiple-choice',
          q.level || null,
          JSON.stringify(q.tags || []),
          Date.now(),
          'batch-import'
        )
        .run();
      
      createdIds.push(questionId);
    }
    
    return jsonResponse({ 
      success: true,
      count: createdIds.length,
      ids: createdIds
    }, 201);
  } catch (error: any) {
    return errorResponse(error.message || '批量创建题目失败', 500);
  }
}
