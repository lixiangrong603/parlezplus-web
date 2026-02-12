// 资源 CRUD API (视频、音频资源管理)

import type { Env, Resource } from '../../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../../utils';

// 辅助函数：从试卷中移除指定的题目ID并重新计算总分
async function removeQuestionsFromExamPapers(env: Env, questionIds: string[]): Promise<void> {
  const questionIdSet = new Set(questionIds);
  
  // 获取所有未删除的试卷
  const { results: papers } = await env.DB
    .prepare('SELECT id, sections, total_score FROM exam_papers WHERE is_deleted = 0')
    .all<{ id: string; sections: string; total_score: number }>();
  
  for (const paper of papers) {
    let paperModified = false;
    const sections = JSON.parse(paper.sections || '[]');
    
    // 遍历每个section，移除引用的题目
    for (const section of sections) {
      const originalLength = section.items?.length || 0;
      if (section.items) {
        section.items = section.items.filter((item: any) => {
          if (item.type === 'consigne') return true; // 保留consigne
          return !questionIdSet.has(item.questionId || '');
        });
      }
      
      if ((section.items?.length || 0) !== originalLength) {
        paperModified = true;
      }
    }
    
    // 如果试卷有变化，重新计算总分并保存
    if (paperModified) {
      const newTotalScore = sections.reduce((total: number, section: any) => {
        return total + (section.items || []).reduce((sectionTotal: number, item: any) => {
          if (item.type === 'consigne') return sectionTotal;
          return sectionTotal + (item.points || 0);
        }, 0);
      }, 0);
      
      await env.DB
        .prepare('UPDATE exam_papers SET sections = ?, total_score = ? WHERE id = ?')
        .bind(JSON.stringify(sections), newTotalScore, paper.id)
        .run();
      
      console.log(`试卷 ${paper.id} 已更新：移除了 ${questionIds.length} 道题目，新总分: ${newTotalScore}`);
    }
  }
}

// ============================================
// GET /api/resources - 获取资源列表
// GET /api/resources/:id - 获取单个资源
// 查询参数: 
//   teacherId (可选，教师查看自己的资源)
//   summary=true (可选，只返回轻量字段，用于列表展示)
// ============================================
export async function onRequestGet(context: any): Promise<Response> {
  const { request, env, params } = context as { request: Request; env: Env; params: { id?: string[] } };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const url = new URL(request.url);
    
    // 检查是否请求单个资源
    const resourceId = params.id && params.id.length > 0 ? params.id.join('/') : null;
    
    if (resourceId) {
      // ========== 单个资源获取 ==========
      let query: D1PreparedStatement;
      
      if (user.role === 'teacher' || user.role === 'admin') {
        // 教师/管理员可以查看自己的任何资源
        query = env.DB
          .prepare('SELECT * FROM resources WHERE id = ? AND is_deleted = 0')
          .bind(resourceId);
      } else {
        // 学生只能查看已发布的资源
        query = env.DB
          .prepare('SELECT * FROM resources WHERE id = ? AND status = ? AND is_deleted = 0')
          .bind(resourceId, 'ready');
      }
      
      const resource = await query.first<Resource>();
      
      if (!resource) {
        return errorResponse('资源不存在或无权访问', 404);
      }
      
      // 解析 JSON 字段
      const parsed: any = {
        ...resource,
        assigned_class_ids: JSON.parse(resource.assigned_class_ids || '[]'),
        grammar_tags: JSON.parse(resource.grammar_tags || '[]'),
        vocab_tags: JSON.parse(resource.vocab_tags || '[]'),
        transcript: JSON.parse(resource.transcript || '[]'),
        raw_azure_words: resource.raw_azure_words ? JSON.parse(resource.raw_azure_words) : null,
        questions: JSON.parse(resource.questions || '[]'),
      };
      
      return jsonResponse(parsed);
    }
    
    // ========== 资源列表获取 ==========
    const teacherId = url.searchParams.get('teacherId');
    const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
    const summaryMode = url.searchParams.get('summary') === 'true';
    
    // 轻量模式：只返回列表展示需要的字段，不包含大型 JSON 数据
    const selectFields = summaryMode 
      ? 'id, channel_id, teacher_id, title, level, cover_r2_key, video_r2_key, audio_r2_key, status, deadline, assigned_class_ids, grammar_tags, vocab_tags, created_at, is_deleted, deleted_at, deleted_by'
      : '*';
    
    let query: D1PreparedStatement;
    
    if (teacherId) {
      // 教师查看自己的资源
      if (user.role !== 'teacher' && user.role !== 'admin') {
        return errorResponse('无权限', 403);
      }
      if (includeDeleted) {
        query = env.DB
          .prepare(`SELECT ${selectFields} FROM resources WHERE teacher_id = ? ORDER BY created_at DESC`)
          .bind(teacherId);
      } else {
        query = env.DB
          .prepare(`SELECT ${selectFields} FROM resources WHERE teacher_id = ? AND is_deleted = 0 ORDER BY created_at DESC`)
          .bind(teacherId);
      }
    } else {
      // 学生查看所有已发布的资源
      query = env.DB
        .prepare(`SELECT ${selectFields} FROM resources WHERE status = ? AND is_deleted = 0 ORDER BY created_at DESC`)
        .bind('ready');
    }
    
    const { results } = await query.all<Resource>();
    
    // 解析 JSON 字段
    const resourcesWithParsedJSON = results.map(resource => {
      const parsed: any = {
        ...resource,
        assigned_class_ids: JSON.parse(resource.assigned_class_ids || '[]'),
        grammar_tags: JSON.parse(resource.grammar_tags || '[]'),
        vocab_tags: JSON.parse(resource.vocab_tags || '[]'),
      };
      
      // 轻量模式不解析大型字段
      if (!summaryMode) {
        parsed.transcript = JSON.parse(resource.transcript || '[]');
        parsed.raw_azure_words = resource.raw_azure_words ? JSON.parse(resource.raw_azure_words) : null;
        parsed.questions = JSON.parse(resource.questions || '[]');
      } else {
        // 轻量模式返回空数组/null，前端需要时再单独请求
        parsed.transcript = [];
        parsed.raw_azure_words = null;
        parsed.questions = [];
      }
      
      return parsed;
    });
    
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
    const hasMedia = !!resource.video_r2_key || !!resource.audio_r2_key;
    if (!resource.channel_id || !resource.title || !resource.level || !hasMedia) {
      console.error('Resource validation failed:', {
        channel_id: resource.channel_id,
        title: resource.title,
        level: resource.level,
        hasMedia,
        video_r2_key: resource.video_r2_key,
        audio_r2_key: resource.audio_r2_key,
        cover_r2_key: resource.cover_r2_key,
      });
      return errorResponse('缺少必填字段: channel_id, title, level, 以及 video 或 audio', 400);
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
  const { request, env, params } = context as { request: Request; env: Env; params: { id: string[] } };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return errorResponse('仅教师可更新资源', 403);
    }
    
    // [[id]] catch-all returns an array
    const resourceId = Array.isArray(params.id) ? params.id.join('/') : params.id;
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
    if (updates.raw_azure_words !== undefined) {
      updateFields.push('raw_azure_words = ?');
      values.push(updates.raw_azure_words ? JSON.stringify(updates.raw_azure_words) : null);
    }
    if (updates.questions !== undefined) {
      updateFields.push('questions = ?');
      values.push(JSON.stringify(updates.questions));
    }
    if (updates.status !== undefined) {
      updateFields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.deadline !== undefined) {
      updateFields.push('deadline = ?');
      values.push(updates.deadline);
    }
    if (updates.assigned_class_ids !== undefined) {
      updateFields.push('assigned_class_ids = ?');
      values.push(JSON.stringify(updates.assigned_class_ids));
    }
    if (updates.grammar_tags !== undefined) {
      updateFields.push('grammar_tags = ?');
      values.push(JSON.stringify(updates.grammar_tags));
    }
    if (updates.vocab_tags !== undefined) {
      updateFields.push('vocab_tags = ?');
      values.push(JSON.stringify(updates.vocab_tags));
    }
    if (updates.video_r2_key !== undefined) {
      updateFields.push('video_r2_key = ?');
      values.push(updates.video_r2_key);
    }
    if (updates.audio_r2_key !== undefined) {
      updateFields.push('audio_r2_key = ?');
      values.push(updates.audio_r2_key);
    }
    if (updates.cover_r2_key !== undefined) {
      updateFields.push('cover_r2_key = ?');
      values.push(updates.cover_r2_key);
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
  const { request, env, params } = context as { request: Request; env: Env; params: { id: string[] } };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
      return errorResponse('仅教师和管理员可删除资源', 403);
    }
    
    // [[id]] catch-all returns an array
    const resourceId = Array.isArray(params.id) ? params.id.join('/') : params.id;
    
    // 先获取资源的quiz题目ID
    const resource = await env.DB
      .prepare('SELECT questions FROM resources WHERE id = ?')
      .bind(resourceId)
      .first<{ questions: string }>();
    
    let resourceQuestionIds: string[] = [];
    if (resource?.questions) {
      try {
        const questions = JSON.parse(resource.questions);
        resourceQuestionIds = questions.map((q: any) => q.id).filter(Boolean);
      } catch (err) {
        console.error('Error parsing resource questions:', err);
      }
    }
    
    // 软删除资源
    await env.DB
      .prepare('UPDATE resources SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?')
      .bind(Date.now(), user.id, resourceId)
      .run();
    
    // 从引用该资源quiz题目的试卷中移除这些题目并重新计算总分
    if (resourceQuestionIds.length > 0) {
      await removeQuestionsFromExamPapers(env, resourceQuestionIds);
    }
    
    return jsonResponse({ success: true });
  } catch (error) {
    console.error('Delete resource error:', error);
    return errorResponse('删除资源失败', 500);
  }
}
