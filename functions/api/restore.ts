// 恢复回收站记录 API

import type { Env } from '../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse } from '../utils';

interface RestoreRequest {
  type: 'resource' | 'channel' | 'user' | 'question' | 'exam-paper' | 'classroom' | 'exam-session' | 'syllabus-course';
  id: string;
}

/**
 * 恢复资源
 */
async function restoreResource(env: Env, resourceId: string, userId: string, userRole: string): Promise<void> {
  // 获取资源
  const resource = await env.DB
    .prepare('SELECT * FROM resources WHERE id = ? AND is_deleted = 1')
    .bind(resourceId)
    .first<any>();
  
  if (!resource) {
    throw new Error('资源不存在或未被删除');
  }
  
  // 权限检查：管理员或资源创建者
  if (userRole !== 'admin' && resource.teacher_id !== userId) {
    throw new Error('无权限恢复此资源');
  }
  
  // 恢复资源
  await env.DB
    .prepare('UPDATE resources SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ?')
    .bind(resourceId)
    .run();
}

/**
 * 恢复频道及其下所有资源
 */
async function restoreChannel(env: Env, channelId: string, userId: string, userRole: string): Promise<void> {
  // 获取频道
  const channel = await env.DB
    .prepare('SELECT * FROM channels WHERE id = ? AND is_deleted = 1')
    .bind(channelId)
    .first<any>();
  
  if (!channel) {
    throw new Error('频道不存在或未被删除');
  }
  
  // 权限检查
  if (userRole !== 'admin' && channel.user_id !== userId) {
    throw new Error('无权限恢复此频道');
  }
  
  // 恢复频道
  await env.DB
    .prepare('UPDATE channels SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ?')
    .bind(channelId)
    .run();
  
  // 恢复频道下的所有资源
  await env.DB
    .prepare('UPDATE resources SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE channel_id = ? AND is_deleted = 1')
    .bind(channelId)
    .run();
}

/**
 * 恢复题目
 */
async function restoreQuestion(env: Env, questionId: string, userId: string, userRole: string): Promise<void> {
  const question = await env.DB
    .prepare('SELECT * FROM question_bank WHERE id = ? AND is_deleted = 1')
    .bind(questionId)
    .first<any>();
  
  if (!question) {
    throw new Error('题目不存在或未被删除');
  }
  
  if (userRole !== 'admin' && question.teacher_id !== userId) {
    throw new Error('无权限恢复此题目');
  }
  
  await env.DB
    .prepare('UPDATE question_bank SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ?')
    .bind(questionId)
    .run();
}

/**
 * 恢复用户
 */
async function restoreUser(env: Env, targetUserId: string, userRole: string): Promise<void> {
  if (userRole !== 'admin') {
    throw new Error('只有管理员可以恢复用户');
  }
  
  const user = await env.DB
    .prepare('SELECT * FROM users WHERE id = ? AND is_deleted = 1')
    .bind(targetUserId)
    .first<any>();
  
  if (!user) {
    throw new Error('用户不存在或未被删除');
  }
  
  // 恢复用户
  await env.DB
    .prepare('UPDATE users SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ?')
    .bind(targetUserId)
    .run();
  
  // 恢复用户的频道
  await env.DB
    .prepare('UPDATE channels SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE user_id = ? AND is_deleted = 1')
    .bind(targetUserId)
    .run();
  
  // 恢复用户的资源
  await env.DB
    .prepare('UPDATE resources SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE teacher_id = ? AND is_deleted = 1')
    .bind(targetUserId)
    .run();
  
  // 恢复用户的题目
  await env.DB
    .prepare('UPDATE question_bank SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE teacher_id = ? AND is_deleted = 1')
    .bind(targetUserId)
    .run();
}

/**
 * 恢复班级
 */
async function restoreClassroom(env: Env, classroomId: string, userId: string, userRole: string): Promise<void> {
  const classroom = await env.DB
    .prepare('SELECT * FROM classrooms WHERE id = ? AND is_deleted = 1')
    .bind(classroomId)
    .first<any>();
  
  if (!classroom) {
    throw new Error('班级不存在或未被删除');
  }
  
  if (userRole !== 'admin' && classroom.user_id !== userId) {
    throw new Error('无权限恢复此班级');
  }
  
  await env.DB
    .prepare('UPDATE classrooms SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ?')
    .bind(classroomId)
    .run();
}

/**
 * 恢复试卷
 */
async function restoreExamPaper(env: Env, paperId: string, userId: string, userRole: string): Promise<void> {
  const paper = await env.DB
    .prepare('SELECT * FROM exam_papers WHERE id = ? AND is_deleted = 1')
    .bind(paperId)
    .first<any>();
  
  if (!paper) {
    throw new Error('试卷不存在或未被删除');
  }
  
  if (userRole !== 'admin' && paper.teacher_id !== userId) {
    throw new Error('无权限恢复此试卷');
  }
  
  await env.DB
    .prepare('UPDATE exam_papers SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ?')
    .bind(paperId)
    .run();
  
  // 恢复关联的考试记录
  await env.DB
    .prepare('UPDATE exam_sessions SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE exam_paper_id = ? AND is_deleted = 1')
    .bind(paperId)
    .run();
}

/**
 * 恢复考试记录
 */
async function restoreExamSession(env: Env, sessionId: string, userId: string, userRole: string): Promise<void> {
  const session = await env.DB
    .prepare('SELECT * FROM exam_sessions WHERE id = ? AND is_deleted = 1')
    .bind(sessionId)
    .first<any>();
  
  if (!session) {
    throw new Error('考试记录不存在或未被删除');
  }
  
  // 检查是否有权限（通过试卷的教师ID）
  if (userRole !== 'admin') {
    const paper = await env.DB
      .prepare('SELECT teacher_id FROM exam_papers WHERE id = ?')
      .bind(session.exam_paper_id)
      .first<{ teacher_id: string }>();
    
    if (!paper || paper.teacher_id !== userId) {
      throw new Error('无权限恢复此考试记录');
    }
  }
  
  await env.DB
    .prepare('UPDATE exam_sessions SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ?')
    .bind(sessionId)
    .run();
}

/**
 * 恢复课程大纲
 */
async function restoreSyllabusCourse(env: Env, courseId: string, userId: string, userRole: string): Promise<void> {
  const course = await env.DB
    .prepare('SELECT * FROM syllabus_courses WHERE id = ? AND is_deleted = 1')
    .bind(courseId)
    .first<any>();
  
  if (!course) {
    throw new Error('课程不存在或未被删除');
  }
  
  if (userRole !== 'admin' && course.user_id !== userId) {
    throw new Error('无权限恢复此课程');
  }
  
  await env.DB
    .prepare('UPDATE syllabus_courses SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL WHERE id = ?')
    .bind(courseId)
    .run();
}

// ============================================
// POST /api/restore - 恢复回收站记录
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };
  
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }
    
    const body = await request.json() as RestoreRequest;
    
    if (!body.type || !body.id) {
      return errorResponse('缺少必要参数: type 和 id', 400);
    }
    
    // 教师权限检查
    if (user.role !== 'admin' && user.role !== 'teacher') {
      return errorResponse('无权限', 403);
    }
    
    // 执行恢复
    switch (body.type) {
      case 'resource':
        await restoreResource(env, body.id, user.id, user.role);
        break;
      case 'channel':
        await restoreChannel(env, body.id, user.id, user.role);
        break;
      case 'question':
        await restoreQuestion(env, body.id, user.id, user.role);
        break;
      case 'user':
        await restoreUser(env, body.id, user.role);
        break;
      case 'exam-paper':
        await restoreExamPaper(env, body.id, user.id, user.role);
        break;
      case 'classroom':
        await restoreClassroom(env, body.id, user.id, user.role);
        break;
      case 'exam-session':
        await restoreExamSession(env, body.id, user.id, user.role);
        break;
      case 'syllabus-course':
        await restoreSyllabusCourse(env, body.id, user.id, user.role);
        break;
      default:
        return errorResponse('不支持的类型', 400);
    }
    
    return jsonResponse({ success: true, message: `${body.type} 已恢复` });
  } catch (error: any) {
    console.error('Restore error:', error);
    return errorResponse(error.message || '恢复失败', 500);
  }
}
