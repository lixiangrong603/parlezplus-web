import type { Env } from '../../../../types/worker';
import { getUserFromRequest, jsonResponse, errorResponse, hashPassword, verifyPassword } from '../../../utils';

// ============================================
// POST /api/users/:id/change-password - 修改密码/管理员重置密码
// ============================================
export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };

  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse('未授权', 401);
    }

    const url = new URL(request.url);
    const parts = url.pathname.split('/api/users/');
    const targetUserId = parts[1]?.split('/')[0];

    if (!targetUserId) {
      return errorResponse('缺少用户 ID', 400);
    }

    // 权限检查：管理员可以改任何人密码；非管理员只能改自己的
    if (user.role !== 'admin' && user.id !== targetUserId) {
      return errorResponse('无权限', 403);
    }

    const body = await request.json() as {
      oldPassword?: string;
      newPassword: string;
      // 管理员重置后一般应强制修改密码
      needsPasswordChange?: boolean;
    };

    if (!body.newPassword) {
      return errorResponse('缺少新密码', 400);
    }

    // 非管理员需要验证旧密码
    if (user.role !== 'admin') {
      if (!body.oldPassword) {
        return errorResponse('缺少旧密码', 400);
      }

      const targetUser = await env.DB
        .prepare('SELECT password_hash FROM users WHERE id = ?')
        .bind(targetUserId)
        .first<{ password_hash: string }>();

      if (!targetUser) {
        return errorResponse('用户不存在', 404);
      }

      const valid = await verifyPassword(body.oldPassword, targetUser.password_hash);
      if (!valid) {
        return errorResponse('旧密码错误', 400);
      }
    }

    const newPasswordHash = await hashPassword(body.newPassword);

    const needsPasswordChange = body.needsPasswordChange ?? (user.role === 'admin');

    await env.DB
      .prepare('UPDATE users SET password_hash = ?, needs_password_change = ? WHERE id = ?')
      .bind(newPasswordHash, needsPasswordChange ? 1 : 0, targetUserId)
      .run();

    return jsonResponse({ success: true, message: '密码已修改' });
  } catch (error: any) {
    return errorResponse(error.message || '修改密码失败', 500);
  }
}
