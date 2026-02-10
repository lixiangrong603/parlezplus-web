// 数据清理 API (永久删除包括 R2 文件)

import type { Env } from '../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../utils';

interface DeleteRequest {
  type: 'resource' | 'channel' | 'user' | 'question' | 'exam-paper';
  id: string;
}

/**
 * 从 R2 删除单个文件
 */
async function deleteR2File(env: Env, r2Key: string | undefined | null): Promise<void> {
  if (!r2Key) return;
  
  try {
    await env.R2_BUCKET.delete(r2Key);
    console.log(`Deleted R2 file: ${r2Key}`);
  } catch (error) {
    console.error(`Failed to delete R2 file ${r2Key}:`, error);
    // 不中断流程，继续删除其他文件
  }
}

/**
 * 删除资源及其所有关联媒体文件
 */
async function permanentlyDeleteResource(env: Env, resourceId: string): Promise<void> {
  // 获取资源详情
  const resource = await env.DB
    .prepare('SELECT * FROM resources WHERE id = ?')
    .bind(resourceId)
    .first<any>();
  
  if (!resource) return;
  
  // 删除所有关联的 R2 文件
  await deleteR2File(env, resource.video_r2_key);
  await deleteR2File(env, resource.audio_r2_key);
  await deleteR2File(env, resource.backing_track_r2_key);
  await deleteR2File(env, resource.vocal_track_r2_key);
  await deleteR2File(env, resource.cover_r2_key);
  
  // 删除学生练习数据中的录音文件
  const practiceData = await env.DB
    .prepare('SELECT * FROM student_practice_data WHERE resource_id = ?')
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
  
  // 删除作业提交中的录音
  const submissions = await env.DB
    .prepare('SELECT * FROM submissions WHERE resource_id = ?')
    .all<any>();
  
  for (const submission of submissions.results) {
    await deleteR2File(env, submission.audio_r2_key);
  }
  
  // 从数据库中删除所有关联数据
  await env.DB
    .prepare('DELETE FROM student_practice_data WHERE resource_id = ?')
    .bind(resourceId)
    .run();
  
  await env.DB
    .prepare('DELETE FROM submissions WHERE resource_id = ?')
    .bind(resourceId)
    .run();
  
  // 删除资源本身
  await env.DB
    .prepare('DELETE FROM resources WHERE id = ?')
    .bind(resourceId)
    .run();
}

/**
 * 删除频道及其所有关联资源和媒体文件
 */
async function permanentlyDeleteChannel(env: Env, channelId: string): Promise<void> {
  // 获取该频道下所有资源
  const resources = await env.DB
    .prepare('SELECT id FROM resources WHERE channel_id = ?')
    .all<{ id: string }>();
  
  // 递归删除每个资源
  for (const resource of resources.results) {
    await permanentlyDeleteResource(env, resource.id);
  }
  
  // 删除频道
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
// POST /api/cleanup - 永久删除（仅管理员）
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || user.role !== 'admin') {
      return errorResponse('仅管理员可执行此操作', 403);
    }
    
    const body = await request.json() as DeleteRequest;
    
    if (!body.type || !body.id) {
      return errorResponse('缺少必要参数: type 和 id', 400);
    }
    
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
      default:
        return errorResponse('不支持的类型', 400);
    }
    
    return jsonResponse({ success: true, message: `${body.type} 已永久删除` });
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return errorResponse(error.message || '永久删除失败', 500);
  }
}
