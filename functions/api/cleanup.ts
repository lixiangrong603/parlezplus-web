// 数据清理 API (永久删除包括 R2 文件)

import type { Env } from '../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../utils';

interface DeleteRequest {
  type: 'resource' | 'channel' | 'user' | 'question' | 'exam-paper' | 'classroom' | 'exam-session' | 'syllabus-course';
  id: string;
}

/**
 * 从 R2 删除单个文件
 */
async function deleteR2File(env: Env, r2Key: string | undefined | null): Promise<void> {
  if (!r2Key) {
    console.log('⚠️  R2 key is null/undefined, skipping delete');
    return;
  }
  
  console.log(`🗑️  Attempting to delete R2 file: ${r2Key}`);
  
  try {
    await env.R2_BUCKET.delete(r2Key);
    console.log(`✅ Successfully deleted R2 file: ${r2Key}`);
  } catch (error) {
    console.error(`❌ Failed to delete R2 file ${r2Key}:`, error);
    // 不中断流程，继续删除其他文件
  }
}

/**
 * 删除资源及其所有关联媒体文件和数据
 */
async function permanentlyDeleteResource(env: Env, resourceId: string): Promise<void> {
  // 获取资源详情（包括已软删除的记录）
  const resource = await env.DB
    .prepare('SELECT * FROM resources WHERE id = ?')
    .bind(resourceId)
    .first<any>();
  
  if (!resource) {
    console.warn(`Resource ${resourceId} not found in database, may have been already deleted`);
    return;
  }
  
  // 1. 删除所有关联的 R2 媒体文件
  await deleteR2File(env, resource.video_r2_key);
  await deleteR2File(env, resource.audio_r2_key);
  await deleteR2File(env, resource.backing_track_r2_key);
  await deleteR2File(env, resource.vocal_track_r2_key);
  await deleteR2File(env, resource.cover_r2_key);
  
  // 2. 删除学生练习数据中的录音文件
  const practiceData = await env.DB
    .prepare('SELECT * FROM student_practice_data WHERE resource_id = ?')
    .bind(resourceId)
    .all<any>();
  
  for (const data of practiceData.results) {
    if (data.segment_recordings) {
      try {
        const recordings = JSON.parse(data.segment_recordings);
        for (const r2Key of Object.values(recordings)) {
          await deleteR2File(env, r2Key as string);
        }
      } catch (e) {
        console.error('Failed to parse segment_recordings:', e);
      }
    }
    if (data.full_recording_r2_key) {
      await deleteR2File(env, data.full_recording_r2_key);
    }
  }
  
  // 3. 删除作业提交中的录音
  const submissions = await env.DB
    .prepare('SELECT * FROM submissions WHERE resource_id = ?')
    .bind(resourceId)
    .all<any>();
  
  for (const submission of submissions.results) {
    await deleteR2File(env, submission.audio_r2_key);
  }
  
  // 4. 从 D1 数据库中删除所有关联数据
  await env.DB
    .prepare('DELETE FROM student_practice_data WHERE resource_id = ?')
    .bind(resourceId)
    .run();
  
  await env.DB
    .prepare('DELETE FROM submissions WHERE resource_id = ?')
    .bind(resourceId)
    .run();
  
  // 5. 删除资源记录本身
  await env.DB
    .prepare('DELETE FROM resources WHERE id = ?')
    .bind(resourceId)
    .run();
}

/**
 * 删除频道及其所有关联资源和媒体文件
 */
async function permanentlyDeleteChannel(env: Env, channelId: string): Promise<void> {
  // 获取该频道下所有资源（包括已软删除的）
  const resources = await env.DB
    .prepare('SELECT id FROM resources WHERE channel_id = ?')
    .bind(channelId)
    .all<{ id: string }>();
  
  console.log(`Deleting channel ${channelId} with ${resources.results.length} resources`);
  
  // 递归删除每个资源及其R2文件
  for (const resource of resources.results) {
    await permanentlyDeleteResource(env, resource.id);
  }
  
  // 从 D1 数据库删除频道记录
  await env.DB
    .prepare('DELETE FROM channels WHERE id = ?')
    .bind(channelId)
    .run();
}

/**
 * 删除题目中的图片
 */
async function permanentlyDeleteQuestion(env: Env, questionId: string): Promise<void> {
  const question = await env.DB
    .prepare('SELECT image_r2_key, options FROM question_bank WHERE id = ?')
    .bind(questionId)
    .first<any>();
  
  if (!question) return;
  
  // 删除题目图片
  if (question.image_r2_key) {
    await deleteR2File(env, question.image_r2_key);
  }
  
  // 删除选项中的图片
  if (question.options) {
    const options = JSON.parse(question.options);
    for (const option of options) {
      if (option.imageUrl_r2_key) {
        await deleteR2File(env, option.imageUrl_r2_key);
      }
    }
  }
  
  // 删除题目
  await env.DB
    .prepare('DELETE FROM question_bank WHERE id = ?')
    .bind(questionId)
    .run();
}

/**
 * 删除用户的所有数据和文件
 */
async function permanentlyDeleteUser(env: Env, userId: string): Promise<void> {
  // 删除用户头像
  const user = await env.DB
    .prepare('SELECT avatar_r2_key FROM users WHERE id = ?')
    .first<any>();
  
  if (user?.avatar_r2_key) {
    await deleteR2File(env, user.avatar_r2_key);
  }
  
  // 获取用户创建的所有频道
  const channels = await env.DB
    .prepare('SELECT id FROM channels WHERE user_id = ?')
    .all<{ id: string }>();
  
  for (const channel of channels.results) {
    await permanentlyDeleteChannel(env, channel.id);
  }
  
  // 获取用户的所有题目
  const questions = await env.DB
    .prepare('SELECT id FROM question_bank WHERE teacher_id = ?')
    .all<{ id: string }>();
  
  for (const question of questions.results) {
    await permanentlyDeleteQuestion(env, question.id);
  }
  
  // 获取用户的所有试卷
  const papers = await env.DB
    .prepare('SELECT id FROM exam_papers WHERE teacher_id = ?')
    .all<{ id: string }>();
  
  for (const paper of papers.results) {
    await env.DB
      .prepare('DELETE FROM exam_sessions WHERE exam_paper_id = ?')
      .bind(paper.id)
      .run();
  }
  
  await env.DB
    .prepare('DELETE FROM exam_papers WHERE teacher_id = ?')
    .bind(userId)
    .run();
  
  await env.DB
    .prepare('DELETE FROM exam_folders WHERE user_id = ?')
    .bind(userId)
    .run();
  
  await env.DB
    .prepare('DELETE FROM syllabus_courses WHERE user_id = ?')
    .bind(userId)
    .run();
  
  // 删除用户的作业数据
  const submissionsByStudent = await env.DB
    .prepare('SELECT id, audio_r2_key FROM submissions WHERE student_id = ?')
    .all<any>();
  
  for (const submission of submissionsByStudent.results) {
    await deleteR2File(env, submission.audio_r2_key);
  }
  
  await env.DB
    .prepare('DELETE FROM submissions WHERE student_id = ?')
    .bind(userId)
    .run();
  
  // 删除用户的练习数据
  const practiceData = await env.DB
    .prepare('SELECT * FROM student_practice_data WHERE user_id = ?')
    .all<any>();
  
  for (const data of practiceData.results) {
    if (data.segment_recordings) {
      const recordings = JSON.parse(data.segment_recordings);
      for (const r2Key of Object.values(recordings)) {
        await deleteR2File(env, r2Key as string);
      }
    }
    if (data.full_recording_r2_key) {
      await deleteR2File(env, data.full_recording_r2_key);
    }
  }
  
  await env.DB
    .prepare('DELETE FROM student_practice_data WHERE user_id = ?')
    .bind(userId)
    .run();
  
  // 最后删除用户
  await env.DB
    .prepare('DELETE FROM users WHERE id = ?')
    .bind(userId)
    .run();
}

// ============================================
// POST /api/cleanup - 永久删除
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const body = await request.json() as DeleteRequest;
    
    if (!body.type || !body.id) {
      return errorResponse('缺少必要参数: type 和 id', 400);
    }
    
    // 权限检查：管理员可以删除任何内容，教师只能删除自己创建的内容
    if (user.role !== 'admin') {
      // 教师权限检查
      if (user.role !== 'teacher') {
        return errorResponse('无权限', 403);
      }
      
      // 验证资源所有权
      let ownerId: string | null = null;
      
      switch (body.type) {
        case 'resource': {
          const resource = await env.DB
            .prepare('SELECT teacher_id FROM resources WHERE id = ?')
            .bind(body.id)
            .first<{ teacher_id: string }>();
          ownerId = resource?.teacher_id ?? null;
          break;
        }
        case 'channel': {
          const channel = await env.DB
            .prepare('SELECT user_id FROM channels WHERE id = ?')
            .bind(body.id)
            .first<{ user_id: string }>();
          ownerId = channel?.user_id ?? null;
          break;
        }
        case 'question': {
          const question = await env.DB
            .prepare('SELECT teacher_id FROM question_bank WHERE id = ?')
            .bind(body.id)
            .first<{ teacher_id: string }>();
          ownerId = question?.teacher_id ?? null;
          break;
        }
        case 'exam-paper': {
          const paper = await env.DB
            .prepare('SELECT teacher_id FROM exam_papers WHERE id = ?')
            .bind(body.id)
            .first<{ teacher_id: string }>();
          ownerId = paper?.teacher_id ?? null;
          break;
        }
        case 'classroom': {
          const classroom = await env.DB
            .prepare('SELECT user_id FROM classrooms WHERE id = ?')
            .bind(body.id)
            .first<{ user_id: string }>();
          ownerId = classroom?.user_id ?? null;
          break;
        }
        case 'syllabus-course': {
          const course = await env.DB
            .prepare('SELECT user_id FROM syllabus_courses WHERE id = ?')
            .bind(body.id)
            .first<{ user_id: string }>();
          ownerId = course?.user_id ?? null;
          break;
        }
        case 'exam-session': {
          // 考试会话：教师可以删除其试卷相关的会话
          const session = await env.DB
            .prepare('SELECT exam_paper_id FROM exam_sessions WHERE id = ?')
            .bind(body.id)
            .first<{ exam_paper_id: string }>();
          if (session) {
            const paper = await env.DB
              .prepare('SELECT teacher_id FROM exam_papers WHERE id = ?')
              .bind(session.exam_paper_id)
              .first<{ teacher_id: string }>();
            ownerId = paper?.teacher_id ?? null;
          }
          break;
        }
        case 'user':
          // 只有管理员可以删除用户
          return errorResponse('只有管理员可以永久删除用户', 403);
      }
      
      if (!ownerId) {
        return errorResponse(`${body.type} 记录不存在或已被删除`, 404);
      }
      if (ownerId !== user.id) {
        return errorResponse('无权限删除他人的资源', 403);
      }
    }
    
    // 执行删除
    switch (body.type) {
      case 'resource':
        await permanentlyDeleteResource(env, body.id);
        break;
      case 'channel':
        await permanentlyDeleteChannel(env, body.id);
        break;
      case 'question':
        await permanentlyDeleteQuestion(env, body.id);
        break;
      case 'user':
        await permanentlyDeleteUser(env, body.id);
        break;
      case 'exam-paper':
        // 删除试卷和相关考试记录
        await env.DB
          .prepare('DELETE FROM exam_sessions WHERE exam_paper_id = ?')
          .bind(body.id)
          .run();
        await env.DB
          .prepare('DELETE FROM exam_papers WHERE id = ?')
          .bind(body.id)
          .run();
        break;
      case 'classroom':
        // 删除班级（需要先清理学生的 class_id）
        await env.DB
          .prepare('UPDATE users SET class_id = NULL WHERE class_id = ?')
          .bind(body.id)
          .run();
        await env.DB
          .prepare('DELETE FROM classrooms WHERE id = ?')
          .bind(body.id)
          .run();
        break;
      case 'exam-session':
        // 删除考试会话
        await env.DB
          .prepare('DELETE FROM exam_sessions WHERE id = ?')
          .bind(body.id)
          .run();
        break;
      case 'syllabus-course':
        // 删除课程大纲及其关联题目
        // 1. 获取课程信息（包含所有知识点ID）
        const course = await env.DB
          .prepare('SELECT units FROM syllabus_courses WHERE id = ?')
          .bind(body.id)
          .first<{ units: string }>();
        
        if (course && course.units) {
          try {
            const units = JSON.parse(course.units);
            const knowledgePointIds = new Set<string>();
            
            // 收集所有知识点ID
            for (const unit of units) {
              if (unit.knowledgePoints && Array.isArray(unit.knowledgePoints)) {
                for (const kp of unit.knowledgePoints) {
                  knowledgePointIds.add(kp.id);
                }
              }
            }
            
            // 2. 删除所有关联的题目（通过知识点ID关联）
            // 注意：只删除已软删除的题目，避免误删活跃题目
            if (knowledgePointIds.size > 0) {
              const questions = await env.DB
                .prepare('SELECT id, image_r2_key, options, knowledge_point_ids FROM question_bank WHERE is_deleted = 1')
                .all<any>();
              
              for (const question of questions.results) {
                try {
                  const questionKpIds = question.knowledge_point_ids 
                    ? JSON.parse(question.knowledge_point_ids) 
                    : [];
                  
                  // 如果题目关联了这个课程的任何知识点，就删除
                  const hasReference = questionKpIds.some((id: string) => knowledgePointIds.has(id));
                  if (hasReference) {
                    await permanentlyDeleteQuestion(env, question.id);
                  }
                } catch (err) {
                  console.error(`Error checking question ${question.id}:`, err);
                }
              }
            }
          } catch (err) {
            console.error('Error parsing course units:', err);
          }
        }
        
        // 3. 删除课程本身
        await env.DB
          .prepare('DELETE FROM syllabus_courses WHERE id = ?')
          .bind(body.id)
          .run();
        break;
      default:
        return errorResponse('不支持的类型', 400);
    }
    
    return jsonResponse({ success: true, message: `${body.type} 已永久删除` });
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return errorResponse(error.message || '永久删除失败', 500);
  }
}
