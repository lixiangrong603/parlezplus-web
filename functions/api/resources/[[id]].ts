// 资源 CRUD API (视频、音频资源管理)

import type { Env, Resource } from '../../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../../utils';

// ============================================
// GET /api/resources - 获取资源列表
// 查询参数: teacherId (可选，教师查看自己的资源)
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
    
    let query: D1PreparedStatement;
    
    if (teacherId) {
      // 教师查看自己的资源
      if (user.role !== 'teacher' && user.role !== 'admin') {
        return errorResponse('无权限', 403);
      }
      query = env.DB
        .prepare('SELECT * FROM resources WHERE teacher_id = ? AND is_deleted = 0 ORDER BY created_at DESC')
        .bind(teacherId);
    } else {
      // 学生查看所有已发布的资源
      query = env.DB
        .prepare('SELECT * FROM resources WHERE status = ? AND is_deleted = 0 ORDER BY created_at DESC')
        .bind('ready');
    }
    
    const { results } = await query.all<Resource>();
    
    // 解析 JSON 字段
    const resourcesWithParsedJSON = results.map(resource => ({
      ...resource,
      transcript: JSON.parse(resource.transcript || '[]'),
      raw_azure_words: resource.raw_azure_words ? JSON.parse(resource.raw_azure_words) : null,
      questions: JSON.parse(resource.questions || '[]'),
      assigned_class_ids: JSON.parse(resource.assigned_class_ids || '[]'),
      grammar_tags: JSON.parse(resource.grammar_tags || '[]'),
      vocab_tags: JSON.parse(resource.vocab_tags || '[]'),
    }));
    
    return jsonResponse(resourcesWithParsedJSON);
  } catch (error) {
    console.error('Get resources error:', error);
    return errorResponse('获取资源失败', 500);
  }
}

// ============================================
// POST /api/resources - 创建新资源
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || user.role !== 'teacher') {
      return errorResponse('仅教师可创建资源', 403);
    }
    
    const resource = await request.json() as Partial<Resource>;
    
    // 验证必填字段
    if (!resource.channel_id || !resource.title || !resource.level || 
        !resource.video_r2_key || !resource.cover_r2_key) {
      return errorResponse('缺少必填字段', 400);
    }
    
    const id = `res-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = Date.now();
    
    await env.DB
      .prepare(`
        INSERT INTO resources (
          id, channel_id, teacher_id, title, level,
          video_r2_key, audio_r2_key, backing_track_r2_key, vocal_track_r2_key, cover_r2_key,
          transcript, raw_azure_words, questions,
          status, deadline, assigned_class_ids, grammar_tags, vocab_tags,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        id,
        resource.channel_id,
        user.id,
        resource.title,
        resource.level,
        resource.video_r2_key,
        resource.audio_r2_key || null,
        resource.backing_track_r2_key || null,
        resource.vocal_track_r2_key || null,
        resource.cover_r2_key,
        JSON.stringify(resource.transcript || []),
        resource.raw_azure_words ? JSON.stringify(resource.raw_azure_words) : null,
        JSON.stringify(resource.questions || []),
        resource.status || 'draft',
        resource.deadline || null,
        JSON.stringify(resource.assigned_class_ids || []),
        JSON.stringify(resource.grammar_tags || []),
        JSON.stringify(resource.vocab_tags || []),
        now
      )
      .run();
    
    return jsonResponse({ id, created_at: now });
  } catch (error) {
    console.error('Create resource error:', error);
    return errorResponse('创建资源失败', 500);
  }
}

// ============================================
// PUT /api/resources/:id - 更新资源
// ============================================
export async function onRequestPut(context: any): Promise<Response> {
  const { request, env, params } = context as { request: Request; env: Env; params: { id: string } };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return errorResponse('仅教师可更新资源', 403);
    }
    
    const resourceId = params.id;
    const updates = await request.json() as Partial<Resource>;
    
    // 验证资源是否存在且属于当前教师
    const existing = await env.DB
      .prepare('SELECT teacher_id FROM resources WHERE id = ? AND is_deleted = 0')
      .bind(resourceId)
      .first<{ teacher_id: string }>();
    
    if (!existing) {
      return errorResponse('资源不存在', 404);
    }
    
    if (existing.teacher_id !== user.id && user.role !== 'admin') {
      return errorResponse('无权限修改此资源', 403);
    }
    
    // 构建更新语句
    const updateFields: string[] = [];
    const values: any[] = [];
    
    if (updates.title !== undefined) {
      updateFields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.level !== undefined) {
      updateFields.push('level = ?');
      values.push(updates.level);
    }
    if (updates.transcript !== undefined) {
      updateFields.push('transcript = ?');
      values.push(JSON.stringify(updates.transcript));
    }
    if (updates.questions !== undefined) {
      updateFields.push('questions = ?');
      values.push(JSON.stringify(updates.questions));
    }
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      values.push(updates.status);
    }
    
    if (updateFields.length === 0) {
      return errorResponse('没有需要更新的字段', 400);
    }
    
    values.push(resourceId);
    
    await env.DB
      .prepare(`UPDATE resources SET ${updateFields.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
    
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Update resource error:', error);
    return errorResponse('更新资源失败', 500);
  }
}

// ============================================
// DELETE /api/resources/:id - 删除资源 (软删除)
// ============================================
export async function onRequestDelete(context: any): Promise<Response> {
  const { request, env, params } = context as { request: Request; env: Env; params: { id: string } };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || user.role !== 'teacher') {
      return errorResponse('仅教师可删除资源', 403);
    }
    
    const resourceId = params.id;
    
    await env.DB
      .prepare('UPDATE resources SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?')
      .bind(Date.now(), user.id, resourceId)
      .run();
    
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Delete resource error:', error);
    return errorResponse('删除资源失败', 500);
  }
}
