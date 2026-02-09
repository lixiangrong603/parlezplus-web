// 运行时诊断接口（不返回敏感信息）

import type { Env } from '../../types/worker';
import { jsonResponse, errorResponse } from '../utils';

// GET /api/diag
export async function onRequestGet(context: any): Promise<Response> {
  const { env } = context as { env: Env };

  try {
    const dbBound = !!env.DB;
    const jwtConfigured = !!env.JWT_SECRET;

    let userCount: number | null = null;
    let hasAdmin: boolean | null = null;
    let hasTeacher: boolean | null = null;
    let hasStudent: boolean | null = null;

    if (dbBound) {
      const countRow = await env.DB.prepare('SELECT COUNT(1) as c FROM users').first<{ c: number }>();
      userCount = Number(countRow?.c ?? 0);

      const adminRow = await env.DB.prepare('SELECT 1 as ok FROM users WHERE username = ? LIMIT 1').bind('admin').first<{ ok: number }>();
      hasAdmin = !!adminRow?.ok;

      const teacherRow = await env.DB.prepare('SELECT 1 as ok FROM users WHERE username = ? LIMIT 1').bind('teacher').first<{ ok: number }>();
      hasTeacher = !!teacherRow?.ok;

      const studentRow = await env.DB.prepare('SELECT 1 as ok FROM users WHERE username = ? LIMIT 1').bind('student').first<{ ok: number }>();
      hasStudent = !!studentRow?.ok;
    }

    return jsonResponse({
      ok: true,
      env: {
        dbBound,
        jwtConfigured,
      },
      users: {
        userCount,
        hasAdmin,
        hasTeacher,
        hasStudent,
      },
    });
  } catch (e) {
    console.error('[DIAG] error:', e);
    return errorResponse('diag failed', 500);
  }
}
