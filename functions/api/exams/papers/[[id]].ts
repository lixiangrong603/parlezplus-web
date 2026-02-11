// 试卷详情 API (PUT/DELETE /api/exams/papers/:id)

import type { Env, ExamPaper } from '../../../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../../../utils';

// ============================================
// PUT /api/exams/papers/:id - 更新试卷
// ============================================
export async function onRequestPut(context: any): Promise<Response> {
  const { request, env, params } = context as { request: Request; env: Env; params: any };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    // [[id]] catch-all returns an array
    const examId = Array.isArray(params.id) ? params.id[0] : params.id;
    
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
export async function onRequestDelete(context: any): Promise<Response> {
  const { request, env, params } = context as { request: Request; env: Env; params: any };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    // [[id]] catch-all returns an array
    const examId = Array.isArray(params.id) ? params.id[0] : params.id;
    
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
