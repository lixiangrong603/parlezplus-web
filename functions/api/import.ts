// 批量导入 API (数据迁移工具)

import type { Env } from '../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse, hashPassword } from '../utils';

// ============================================
// POST /api/import - 批量导入数据
// ============================================
export async function onRequest(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  if (request.method !== 'POST') {
    return errorResponse('只支持 POST 方法', 405);
  }
  
  try {
    const user = await getUserFromRequest(request, env);
    
    // 只有管理员可以批量导入
    if (!user || user.role !== 'admin') {
      return errorResponse('只有管理员可以批量导入数据', 403);
    }
    
    const body = await request.json() as {
      type: 'users' | 'resources' | 'questions' | 'exams' | 'classrooms';
      data: any[];
      options?: {
        skipExisting?: boolean;
        updateExisting?: boolean;
      };
    };
    
    if (!body.type || !body.data || !Array.isArray(body.data)) {
      return errorResponse('缺少必填字段或数据格式错误', 400);
    }
    
    const results = {
      total: body.data.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [] as Array<{ index: number; error: string }>,
    };
    
    // 根据类型执行不同的导入逻辑
    switch (body.type) {
      case 'users':
        await importUsers(env, body.data, body.options || {}, results);
        break;
      
      case 'resources':
        await importResources(env, body.data, body.options || {}, results, user.id);
        break;
      
      case 'questions':
        await importQuestions(env, body.data, body.options || {}, results, user.id);
        break;
      
      case 'exams':
        await importExams(env, body.data, body.options || {}, results, user.id);
        break;
      
      case 'classrooms':
        await importClassrooms(env, body.data, body.options || {}, results, user.id);
        break;
      
      default:
        return errorResponse('不支持的导入类型', 400);
    }
    
    return jsonResponse(results);
  } catch (error: any) {
    return errorResponse(error.message || '批量导入失败', 500);
  }
}

// ============================================
// 导入用户
// ============================================
async function importUsers(
  env: Env,
  users: any[],
  options: any,
  results: any
): Promise<void> {
  for (let i = 0; i < users.length; i++) {
    const userData = users[i];
    
    try {
      // 验证必填字段
      if (!userData.username || !userData.password || !userData.role || !userData.name) {
        results.errors.push({ index: i, error: '缺少必填字段' });
        results.skipped++;
        continue;
      }
      
      // 检查用户名是否已存在
      const existing = await env.DB
        .prepare('SELECT id FROM users WHERE username = ?')
        .bind(userData.username)
        .first<{ id: string }>();
      
      if (existing) {
        if (options.skipExisting) {
          results.skipped++;
          continue;
        } else if (options.updateExisting) {
          // 更新现有用户
          const updates: string[] = [];
          const values: any[] = [];
          
          if (userData.name) {
            updates.push('name = ?');
            values.push(userData.name);
          }
          
          if (userData.role) {
            updates.push('role = ?');
            values.push(userData.role);
          }
          
          if (userData.class_id !== undefined) {
            updates.push('class_id = ?');
            values.push(userData.class_id);
          }
          
          values.push(existing.id);
          
          await env.DB
            .prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
            .bind(...values)
            .run();
          
          results.updated++;
          continue;
        } else {
          results.errors.push({ index: i, error: '用户名已存在' });
          results.skipped++;
          continue;
        }
      }
      
      // 创建新用户
      const userId = userData.id || `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const passwordHash = await hashPassword(userData.password);
      
      await env.DB
        .prepare(`
          INSERT INTO users (id, username, password_hash, role, name, class_id, avatar_r2_key, needs_password_change, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          userId,
          userData.username,
          passwordHash,
          userData.role,
          userData.name,
          userData.class_id || null,
          userData.avatar_r2_key || null,
          userData.needs_password_change || 0,
          userData.created_at || Date.now()
        )
        .run();
      
      results.created++;
    } catch (error: any) {
      results.errors.push({ index: i, error: error.message });
      results.skipped++;
    }
  }
}

// ============================================
// 导入资源
// ============================================
async function importResources(
  env: Env,
  resources: any[],
  options: any,
  results: any,
  importerId: string
): Promise<void> {
  for (let i = 0; i < resources.length; i++) {
    const resData = resources[i];
    
    try {
      // 生成或使用提供的 ID
      const resourceId = resData.id || `resource-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // 检查是否已存在
      const existing = await env.DB
        .prepare('SELECT id FROM resources WHERE id = ?')
        .bind(resourceId)
        .first();
      
      if (existing) {
        if (options.skipExisting) {
          results.skipped++;
          continue;
        }
      }
      
      // 插入资源
      await env.DB
        .prepare(`
          INSERT OR REPLACE INTO resources (
            id, channel_id, teacher_id, title, level,
            video_r2_key, audio_r2_key, backing_track_r2_key, vocal_track_r2_key, cover_r2_key,
            transcript, raw_azure_words, questions,
            status, deadline, assigned_class_ids, grammar_tags, vocab_tags, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          resourceId,
          resData.channel_id || 'default-channel',
          resData.teacher_id || importerId,
          resData.title,
          resData.level || 'B1',
          resData.video_r2_key || '',
          resData.audio_r2_key || null,
          resData.backing_track_r2_key || null,
          resData.vocal_track_r2_key || null,
          resData.cover_r2_key || '',
          typeof resData.transcript === 'string' ? resData.transcript : JSON.stringify(resData.transcript || []),
          resData.raw_azure_words ? (typeof resData.raw_azure_words === 'string' ? resData.raw_azure_words : JSON.stringify(resData.raw_azure_words)) : null,
          typeof resData.questions === 'string' ? resData.questions : JSON.stringify(resData.questions || []),
          resData.status || 'draft',
          resData.deadline || null,
          typeof resData.assigned_class_ids === 'string' ? resData.assigned_class_ids : JSON.stringify(resData.assigned_class_ids || []),
          typeof resData.grammar_tags === 'string' ? resData.grammar_tags : JSON.stringify(resData.grammar_tags || []),
          typeof resData.vocab_tags === 'string' ? resData.vocab_tags : JSON.stringify(resData.vocab_tags || []),
          resData.created_at || Date.now()
        )
        .run();
      
      results.created++;
    } catch (error: any) {
      results.errors.push({ index: i, error: error.message });
      results.skipped++;
    }
  }
}

// ============================================
// 导入题目
// ============================================
async function importQuestions(
  env: Env,
  questions: any[],
  options: any,
  results: any,
  importerId: string
): Promise<void> {
  for (let i = 0; i < questions.length; i++) {
    const qData = questions[i];
    
    try {
      const questionId = qData.id || `question-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      await env.DB
        .prepare(`
          INSERT OR REPLACE INTO question_bank (
            id, teacher_id, text, image_r2_key, options, correct_option_id,
            explanation, type, level, knowledge_point_ids, tags,
            reading_passage, sub_questions, created_at, created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          questionId,
          qData.teacher_id || importerId,
          qData.text,
          qData.image_r2_key || null,
          typeof qData.options === 'string' ? qData.options : JSON.stringify(qData.options || []),
          qData.correct_option_id,
          qData.explanation || null,
          qData.type || 'multiple-choice',
          qData.level || null,
          typeof qData.knowledge_point_ids === 'string' ? qData.knowledge_point_ids : JSON.stringify(qData.knowledge_point_ids || []),
          typeof qData.tags === 'string' ? qData.tags : JSON.stringify(qData.tags || []),
          qData.reading_passage || null,
          qData.sub_questions ? (typeof qData.sub_questions === 'string' ? qData.sub_questions : JSON.stringify(qData.sub_questions)) : null,
          qData.created_at || Date.now(),
          'import'
        )
        .run();
      
      results.created++;
    } catch (error: any) {
      results.errors.push({ index: i, error: error.message });
      results.skipped++;
    }
  }
}

// ============================================
// 导入试卷
// ============================================
async function importExams(
  env: Env,
  exams: any[],
  options: any,
  results: any,
  importerId: string
): Promise<void> {
  for (let i = 0; i < exams.length; i++) {
    const examData = exams[i];
    
    try {
      const examId = examData.id || `exam-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      await env.DB
        .prepare(`
          INSERT OR REPLACE INTO exam_papers (
            id, teacher_id, title, sections, total_score,
            assigned_class_ids, assigned_class_deadlines, exam_taker_settings, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          examId,
          examData.teacher_id || importerId,
          examData.title,
          typeof examData.sections === 'string' ? examData.sections : JSON.stringify(examData.sections || []),
          examData.total_score || 0,
          typeof examData.assigned_class_ids === 'string' ? examData.assigned_class_ids : JSON.stringify(examData.assigned_class_ids || []),
          typeof examData.assigned_class_deadlines === 'string' ? examData.assigned_class_deadlines : JSON.stringify(examData.assigned_class_deadlines || {}),
          examData.exam_taker_settings ? (typeof examData.exam_taker_settings === 'string' ? examData.exam_taker_settings : JSON.stringify(examData.exam_taker_settings)) : null,
          examData.created_at || Date.now()
        )
        .run();
      
      results.created++;
    } catch (error: any) {
      results.errors.push({ index: i, error: error.message });
      results.skipped++;
    }
  }
}

// ============================================
// 导入班级
// ============================================
async function importClassrooms(
  env: Env,
  classrooms: any[],
  options: any,
  results: any,
  importerId: string
): Promise<void> {
  for (let i = 0; i < classrooms.length; i++) {
    const classData = classrooms[i];
    
    try {
      const classId = classData.id || `class-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      const students = Array.isArray(classData.students) ? classData.students : [];
      
      await env.DB
        .prepare(`
          INSERT OR REPLACE INTO classrooms (
            id, user_id, name, student_count, students, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          classId,
          classData.user_id || importerId,
          classData.name,
          students.length,
          JSON.stringify(students),
          classData.created_at || Date.now()
        )
        .run();
      
      results.created++;
    } catch (error: any) {
      results.errors.push({ index: i, error: error.message });
      results.skipped++;
    }
  }
}
