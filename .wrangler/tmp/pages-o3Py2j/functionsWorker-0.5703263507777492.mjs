var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../.wrangler/tmp/bundle-edWscI/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// utils.ts
async function generateJWT(user, secret) {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    iat: Math.floor(Date.now() / 1e3),
    exp: Math.floor(Date.now() / 1e3) + 7 * 24 * 60 * 60
    // 7天过期
  };
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = await signHMAC(signatureInput, secret);
  return `${signatureInput}.${signature}`;
}
__name(generateJWT, "generateJWT");
async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = await signHMAC(signatureInput, secret);
    if (signature !== expectedSignature) return null;
    const payload = JSON.parse(atob(encodedPayload));
    if (payload.exp < Math.floor(Date.now() / 1e3)) return null;
    return payload;
  } catch {
    return null;
  }
}
__name(verifyJWT, "verifyJWT");
async function signHMAC(data, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
__name(signHMAC, "signHMAC");
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `$sha256$${hashHex}`;
}
__name(hashPassword, "hashPassword");
async function verifyPassword(password, hash) {
  const computed = await hashPassword(password);
  return computed === hash;
}
__name(verifyPassword, "verifyPassword");
async function encryptApiKey(plaintext, masterKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterKey.padEnd(32, "0").substring(0, 32)),
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    data
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}
__name(encryptApiKey, "encryptApiKey");
async function decryptApiKey(encrypted, masterKey) {
  const decoder = new TextDecoder();
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterKey.padEnd(32, "0").substring(0, 32)),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    keyMaterial,
    ciphertext
  );
  return decoder.decode(plaintext);
}
__name(decryptApiKey, "decryptApiKey");
function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400"
  };
}
__name(corsHeaders, "corsHeaders");
function handleOptions(request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("Origin") || void 0)
  });
}
__name(handleOptions, "handleOptions");
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders()
    }
  });
}
__name(jsonResponse, "jsonResponse");
function errorResponse(error, status = 400) {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders()
    }
  });
}
__name(errorResponse, "errorResponse");
async function getUserFromRequest(request, env) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload) return null;
  const result = await env.DB.prepare("SELECT * FROM users WHERE id = ? AND is_deleted = 0 AND is_blocked = 0").bind(payload.userId).first();
  return result || null;
}
__name(getUserFromRequest, "getUserFromRequest");

// api/users/[id]/api-keys.ts
async function onRequestGet(context) {
  const { request, env, params } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    if (user.id !== params.id && user.role !== "admin") {
      return errorResponse("\u65E0\u6743\u8BBF\u95EE", 403);
    }
    const keyRecord = await env.DB.prepare("SELECT gemini_key_encrypted, azure_key_encrypted, azure_region FROM user_api_keys WHERE user_id = ?").bind(params.id).first();
    return jsonResponse({
      hasGeminiKey: !!keyRecord?.gemini_key_encrypted,
      hasAzureKey: !!keyRecord?.azure_key_encrypted,
      azureRegion: keyRecord?.azure_region || "westeurope"
    });
  } catch (error) {
    console.error("Get API keys error:", error);
    return errorResponse("\u83B7\u53D6\u5931\u8D25", 500);
  }
}
__name(onRequestGet, "onRequestGet");
async function onRequestPut(context) {
  const { request, env, params } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    if (user.id !== params.id && user.role !== "admin") {
      return errorResponse("\u65E0\u6743\u4FEE\u6539", 403);
    }
    const body = await request.json();
    const masterKey = env.GEMINI_MASTER_KEY || env.AZURE_MASTER_KEY || "";
    const existing = await env.DB.prepare("SELECT user_id FROM user_api_keys WHERE user_id = ?").bind(params.id).first();
    if (!existing) {
      const geminiEncrypted = body.geminiKey ? await encryptApiKey(body.geminiKey, masterKey) : null;
      const azureEncrypted = body.azureKey ? await encryptApiKey(body.azureKey, masterKey) : null;
      await env.DB.prepare(`
          INSERT INTO user_api_keys (user_id, gemini_key_encrypted, azure_key_encrypted, azure_region)
          VALUES (?, ?, ?, ?)
        `).bind(params.id, geminiEncrypted, azureEncrypted, body.azureRegion || "westeurope").run();
    } else {
      const updates = [];
      const values = [];
      if (body.geminiKey !== void 0) {
        const encrypted = body.geminiKey ? await encryptApiKey(body.geminiKey, masterKey) : null;
        updates.push("gemini_key_encrypted = ?");
        values.push(encrypted);
      }
      if (body.azureKey !== void 0) {
        const encrypted = body.azureKey ? await encryptApiKey(body.azureKey, masterKey) : null;
        updates.push("azure_key_encrypted = ?");
        values.push(encrypted);
      }
      if (body.azureRegion) {
        updates.push("azure_region = ?");
        values.push(body.azureRegion);
      }
      if (updates.length > 0) {
        values.push(params.id);
        await env.DB.prepare(`UPDATE user_api_keys SET ${updates.join(", ")} WHERE user_id = ?`).bind(...values).run();
      }
    }
    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Update API keys error:", error);
    return errorResponse("\u66F4\u65B0\u5931\u8D25", 500);
  }
}
__name(onRequestPut, "onRequestPut");
async function onRequestDelete(context) {
  const { request, env, params } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    if (user.id !== params.id && user.role !== "admin") {
      return errorResponse("\u65E0\u6743\u5220\u9664", 403);
    }
    await env.DB.prepare("DELETE FROM user_api_keys WHERE user_id = ?").bind(params.id).run();
    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Delete API keys error:", error);
    return errorResponse("\u5220\u9664\u5931\u8D25", 500);
  }
}
__name(onRequestDelete, "onRequestDelete");

// api/users/[id]/change-password.ts
async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const url = new URL(request.url);
    const parts = url.pathname.split("/api/users/");
    const targetUserId = parts[1]?.split("/")[0];
    if (!targetUserId) {
      return errorResponse("\u7F3A\u5C11\u7528\u6237 ID", 400);
    }
    if (user.role !== "admin" && user.id !== targetUserId) {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    const body = await request.json();
    if (!body.newPassword) {
      return errorResponse("\u7F3A\u5C11\u65B0\u5BC6\u7801", 400);
    }
    if (user.role !== "admin") {
      if (!body.oldPassword) {
        return errorResponse("\u7F3A\u5C11\u65E7\u5BC6\u7801", 400);
      }
      const targetUser = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(targetUserId).first();
      if (!targetUser) {
        return errorResponse("\u7528\u6237\u4E0D\u5B58\u5728", 404);
      }
      const valid = await verifyPassword(body.oldPassword, targetUser.password_hash);
      if (!valid) {
        return errorResponse("\u65E7\u5BC6\u7801\u9519\u8BEF", 400);
      }
    }
    const newPasswordHash = await hashPassword(body.newPassword);
    const needsPasswordChange = body.needsPasswordChange ?? user.role === "admin";
    await env.DB.prepare("UPDATE users SET password_hash = ?, needs_password_change = ? WHERE id = ?").bind(newPasswordHash, needsPasswordChange ? 1 : 0, targetUserId).run();
    return jsonResponse({ success: true, message: "\u5BC6\u7801\u5DF2\u4FEE\u6539" });
  } catch (error) {
    return errorResponse(error.message || "\u4FEE\u6539\u5BC6\u7801\u5931\u8D25", 500);
  }
}
__name(onRequestPost, "onRequestPost");

// api/classrooms/[[id]].ts
async function onRequestGet2(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const url = new URL(request.url);
    const teacherId = url.searchParams.get("teacherId");
    let query;
    if (user.role === "admin" && !teacherId) {
      query = env.DB.prepare("SELECT * FROM classrooms WHERE is_deleted = 0 ORDER BY created_at DESC");
    } else if (user.role === "teacher" || teacherId) {
      const targetTeacherId = teacherId || user.id;
      query = env.DB.prepare("SELECT * FROM classrooms WHERE user_id = ? AND is_deleted = 0 ORDER BY created_at DESC").bind(targetTeacherId);
    } else if (user.role === "student") {
      if (!user.class_id) {
        return jsonResponse([]);
      }
      query = env.DB.prepare("SELECT * FROM classrooms WHERE id = ? AND is_deleted = 0").bind(user.class_id);
    } else {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    const { results } = await query.all();
    const classroomsWithParsedStudents = results.map((classroom) => ({
      ...classroom,
      students: JSON.parse(classroom.students || "[]")
    }));
    return jsonResponse(classroomsWithParsedStudents);
  } catch (error) {
    return errorResponse(error.message || "\u83B7\u53D6\u73ED\u7EA7\u5217\u8868\u5931\u8D25", 500);
  }
}
__name(onRequestGet2, "onRequestGet");
async function onRequestPost2(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || user.role !== "teacher" && user.role !== "admin") {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    const body = await request.json();
    if (!body.name) {
      return errorResponse("\u7F3A\u5C11\u73ED\u7EA7\u540D\u79F0", 400);
    }
    const teacherId = user.role === "admin" && body.teacherId ? body.teacherId : user.id;
    const classroomId = `class-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    await env.DB.prepare(`
        INSERT INTO classrooms (id, user_id, name, student_count, students, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
      classroomId,
      teacherId,
      body.name,
      0,
      "[]",
      // 空学生列表
      Date.now()
    ).run();
    return jsonResponse({
      id: classroomId,
      user_id: teacherId,
      name: body.name,
      student_count: 0,
      students: []
    }, 201);
  } catch (error) {
    return errorResponse(error.message || "\u521B\u5EFA\u73ED\u7EA7\u5931\u8D25", 500);
  }
}
__name(onRequestPost2, "onRequestPost");
async function onRequestPut2(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/api/classrooms/");
    const classroomId = pathParts[1]?.split("?")[0];
    if (!classroomId) {
      return errorResponse("\u7F3A\u5C11\u73ED\u7EA7 ID", 400);
    }
    const classroom = await env.DB.prepare("SELECT * FROM classrooms WHERE id = ? AND is_deleted = 0").bind(classroomId).first();
    if (!classroom) {
      return errorResponse("\u73ED\u7EA7\u4E0D\u5B58\u5728", 404);
    }
    if (user.role !== "admin" && classroom.user_id !== user.id) {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    const body = await request.json();
    const updates = [];
    const values = [];
    if (body.name !== void 0) {
      updates.push("name = ?");
      values.push(body.name);
    }
    if (body.students !== void 0) {
      updates.push("students = ?");
      updates.push("student_count = ?");
      values.push(JSON.stringify(body.students));
      values.push(body.students.length);
    }
    if (updates.length === 0) {
      return errorResponse("\u6CA1\u6709\u8981\u66F4\u65B0\u7684\u5B57\u6BB5", 400);
    }
    values.push(classroomId);
    await env.DB.prepare(`UPDATE classrooms SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
    return jsonResponse({ success: true, message: "\u73ED\u7EA7\u4FE1\u606F\u5DF2\u66F4\u65B0" });
  } catch (error) {
    return errorResponse(error.message || "\u66F4\u65B0\u73ED\u7EA7\u5931\u8D25", 500);
  }
}
__name(onRequestPut2, "onRequestPut");
async function onRequestDelete2(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/api/classrooms/");
    const classroomId = pathParts[1]?.split("?")[0];
    if (!classroomId) {
      return errorResponse("\u7F3A\u5C11\u73ED\u7EA7 ID", 400);
    }
    const classroom = await env.DB.prepare("SELECT * FROM classrooms WHERE id = ? AND is_deleted = 0").bind(classroomId).first();
    if (!classroom) {
      return errorResponse("\u73ED\u7EA7\u4E0D\u5B58\u5728", 404);
    }
    if (user.role !== "admin" && classroom.user_id !== user.id) {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    await env.DB.prepare("UPDATE classrooms SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?").bind(Date.now(), user.id, classroomId).run();
    return jsonResponse({ success: true, message: "\u73ED\u7EA7\u5DF2\u5220\u9664" });
  } catch (error) {
    return errorResponse(error.message || "\u5220\u9664\u73ED\u7EA7\u5931\u8D25", 500);
  }
}
__name(onRequestDelete2, "onRequestDelete");

// api/exams/[[id]].ts
async function onRequestGet3(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const url = new URL(request.url);
    const teacherId = url.searchParams.get("teacherId");
    const classId = url.searchParams.get("classId");
    let query;
    if (user.role === "admin" && !teacherId) {
      query = env.DB.prepare("SELECT * FROM exam_papers WHERE is_deleted = 0 ORDER BY created_at DESC");
    } else if (user.role === "teacher" || teacherId) {
      const targetTeacherId = teacherId || user.id;
      query = env.DB.prepare("SELECT * FROM exam_papers WHERE teacher_id = ? AND is_deleted = 0 ORDER BY created_at DESC").bind(targetTeacherId);
    } else if (user.role === "student" && classId) {
      query = env.DB.prepare(`SELECT * FROM exam_papers WHERE is_deleted = 0 AND assigned_class_ids LIKE ? ORDER BY created_at DESC`).bind(`%"${classId}"%`);
    } else {
      return errorResponse("\u65E0\u6743\u9650\u6216\u7F3A\u5C11\u53C2\u6570", 403);
    }
    const { results } = await query.all();
    const papersWithParsedJSON = results.map((paper) => ({
      ...paper,
      sections: JSON.parse(paper.sections || "[]"),
      assigned_class_ids: JSON.parse(paper.assigned_class_ids || "[]"),
      assigned_class_deadlines: JSON.parse(paper.assigned_class_deadlines || "{}"),
      exam_taker_settings: paper.exam_taker_settings ? JSON.parse(paper.exam_taker_settings) : null
    }));
    return jsonResponse(papersWithParsedJSON);
  } catch (error) {
    return errorResponse(error.message || "\u83B7\u53D6\u8BD5\u5377\u5217\u8868\u5931\u8D25", 500);
  }
}
__name(onRequestGet3, "onRequestGet");
async function onRequestPost3(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || user.role !== "teacher" && user.role !== "admin") {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    const body = await request.json();
    if (!body.title || !body.sections || body.total_score === void 0) {
      return errorResponse("\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5", 400);
    }
    const examId = `exam-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    await env.DB.prepare(`
        INSERT INTO exam_papers (
          id, teacher_id, title, sections, total_score,
          assigned_class_ids, assigned_class_deadlines, exam_taker_settings, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
      examId,
      user.id,
      body.title,
      JSON.stringify(body.sections),
      body.total_score,
      JSON.stringify(body.assigned_class_ids || []),
      JSON.stringify(body.assigned_class_deadlines || {}),
      body.exam_taker_settings ? JSON.stringify(body.exam_taker_settings) : null,
      Date.now()
    ).run();
    return jsonResponse({
      id: examId,
      title: body.title,
      total_score: body.total_score
    }, 201);
  } catch (error) {
    return errorResponse(error.message || "\u521B\u5EFA\u8BD5\u5377\u5931\u8D25", 500);
  }
}
__name(onRequestPost3, "onRequestPost");

// api/practice/[[id]].ts
async function onRequestGet4(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");
    const resourceId = url.searchParams.get("resourceId");
    let query;
    if (user.role === "student") {
      if (resourceId) {
        query = env.DB.prepare("SELECT * FROM student_practice_data WHERE user_id = ? AND resource_id = ? AND is_deleted = 0").bind(user.id, resourceId);
      } else {
        query = env.DB.prepare("SELECT * FROM student_practice_data WHERE user_id = ? AND is_deleted = 0 ORDER BY last_updated DESC").bind(user.id);
      }
    } else if (user.role === "teacher" || user.role === "admin") {
      if (userId && resourceId) {
        query = env.DB.prepare("SELECT * FROM student_practice_data WHERE user_id = ? AND resource_id = ? AND is_deleted = 0").bind(userId, resourceId);
      } else if (resourceId) {
        query = env.DB.prepare("SELECT * FROM student_practice_data WHERE resource_id = ? AND is_deleted = 0 ORDER BY last_updated DESC").bind(resourceId);
      } else if (userId) {
        query = env.DB.prepare("SELECT * FROM student_practice_data WHERE user_id = ? AND is_deleted = 0 ORDER BY last_updated DESC").bind(userId);
      } else {
        return errorResponse("\u9700\u8981\u63D0\u4F9B userId \u6216 resourceId", 400);
      }
    } else {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    const { results } = await query.all();
    const practiceWithParsedJSON = results.map((practice) => ({
      ...practice,
      quiz_answers: practice.quiz_answers ? JSON.parse(practice.quiz_answers) : null,
      quiz_score: practice.quiz_score ? JSON.parse(practice.quiz_score) : null,
      cloze_answers: practice.cloze_answers ? JSON.parse(practice.cloze_answers) : null,
      cloze_score: practice.cloze_score ? JSON.parse(practice.cloze_score) : null,
      segment_recordings: JSON.parse(practice.segment_recordings || "{}"),
      segment_scores: JSON.parse(practice.segment_scores || "{}"),
      overall_score: practice.overall_score ? JSON.parse(practice.overall_score) : null
    }));
    return jsonResponse(practiceWithParsedJSON);
  } catch (error) {
    return errorResponse(error.message || "\u83B7\u53D6\u7EC3\u4E60\u6570\u636E\u5931\u8D25", 500);
  }
}
__name(onRequestGet4, "onRequestGet");
async function onRequestPost4(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || user.role !== "student") {
      return errorResponse("\u53EA\u6709\u5B66\u751F\u53EF\u4EE5\u521B\u5EFA\u7EC3\u4E60\u6570\u636E", 403);
    }
    const body = await request.json();
    if (!body.resource_id) {
      return errorResponse("\u7F3A\u5C11 resource_id", 400);
    }
    const existing = await env.DB.prepare("SELECT id FROM student_practice_data WHERE user_id = ? AND resource_id = ?").bind(user.id, body.resource_id).first();
    if (existing) {
      const updates = [];
      const values = [];
      if (body.quiz_answers !== void 0) {
        updates.push("quiz_answers = ?");
        values.push(JSON.stringify(body.quiz_answers));
      }
      if (body.quiz_score !== void 0) {
        updates.push("quiz_score = ?");
        values.push(JSON.stringify(body.quiz_score));
      }
      if (body.cloze_answers !== void 0) {
        updates.push("cloze_answers = ?");
        values.push(JSON.stringify(body.cloze_answers));
      }
      if (body.cloze_score !== void 0) {
        updates.push("cloze_score = ?");
        values.push(JSON.stringify(body.cloze_score));
      }
      if (body.segment_recordings !== void 0) {
        updates.push("segment_recordings = ?");
        values.push(JSON.stringify(body.segment_recordings));
      }
      if (body.segment_scores !== void 0) {
        updates.push("segment_scores = ?");
        values.push(JSON.stringify(body.segment_scores));
      }
      if (body.full_recording_r2_key !== void 0) {
        updates.push("full_recording_r2_key = ?");
        values.push(body.full_recording_r2_key);
      }
      if (body.overall_score !== void 0) {
        updates.push("overall_score = ?");
        values.push(JSON.stringify(body.overall_score));
      }
      updates.push("last_updated = ?");
      values.push(Date.now());
      values.push(existing.id);
      await env.DB.prepare(`UPDATE student_practice_data SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
      return jsonResponse({ id: existing.id, updated: true });
    } else {
      const practiceId = `practice-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      await env.DB.prepare(`
          INSERT INTO student_practice_data (
            id, user_id, resource_id,
            quiz_answers, quiz_score, cloze_answers, cloze_score,
            segment_recordings, segment_scores, full_recording_r2_key, overall_score,
            last_updated
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
        practiceId,
        user.id,
        body.resource_id,
        body.quiz_answers ? JSON.stringify(body.quiz_answers) : null,
        body.quiz_score ? JSON.stringify(body.quiz_score) : null,
        body.cloze_answers ? JSON.stringify(body.cloze_answers) : null,
        body.cloze_score ? JSON.stringify(body.cloze_score) : null,
        JSON.stringify(body.segment_recordings || {}),
        JSON.stringify(body.segment_scores || {}),
        body.full_recording_r2_key || null,
        body.overall_score ? JSON.stringify(body.overall_score) : null,
        Date.now()
      ).run();
      return jsonResponse({ id: practiceId, created: true }, 201);
    }
  } catch (error) {
    return errorResponse(error.message || "\u4FDD\u5B58\u7EC3\u4E60\u6570\u636E\u5931\u8D25", 500);
  }
}
__name(onRequestPost4, "onRequestPost");
async function onRequestDelete3(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/api/practice/");
    const practiceId = pathParts[1]?.split("?")[0];
    if (!practiceId) {
      return errorResponse("\u7F3A\u5C11\u7EC3\u4E60\u6570\u636E ID", 400);
    }
    const practice = await env.DB.prepare("SELECT * FROM student_practice_data WHERE id = ? AND is_deleted = 0").bind(practiceId).first();
    if (!practice) {
      return errorResponse("\u7EC3\u4E60\u6570\u636E\u4E0D\u5B58\u5728", 404);
    }
    if (user.role === "student" && practice.user_id !== user.id) {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    await env.DB.prepare("UPDATE student_practice_data SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?").bind(Date.now(), user.id, practiceId).run();
    return jsonResponse({ success: true, message: "\u7EC3\u4E60\u6570\u636E\u5DF2\u5220\u9664" });
  } catch (error) {
    return errorResponse(error.message || "\u5220\u9664\u7EC3\u4E60\u6570\u636E\u5931\u8D25", 500);
  }
}
__name(onRequestDelete3, "onRequestDelete");

// api/questions/[[id]].ts
async function onRequestGet5(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const url = new URL(request.url);
    const teacherId = url.searchParams.get("teacherId");
    const type = url.searchParams.get("type");
    const level = url.searchParams.get("level");
    const includeDeleted = url.searchParams.get("includeDeleted") === "true";
    let query;
    const params = [];
    query = "SELECT * FROM question_bank WHERE 1=1";
    if (user.role === "teacher") {
      query += " AND teacher_id = ?";
      params.push(user.id);
    } else if (user.role === "admin" && teacherId) {
      query += " AND teacher_id = ?";
      params.push(teacherId);
    }
    if (type) {
      query += " AND type = ?";
      params.push(type);
    }
    if (level) {
      query += " AND level = ?";
      params.push(level);
    }
    if (!includeDeleted) {
      query += " AND is_deleted = 0";
    }
    query += " ORDER BY created_at DESC";
    const { results } = await env.DB.prepare(query).bind(...params).all();
    const questionsWithParsedJSON = results.map((q) => ({
      ...q,
      options: JSON.parse(q.options || "[]"),
      knowledge_point_ids: JSON.parse(q.knowledge_point_ids || "[]"),
      tags: JSON.parse(q.tags || "[]"),
      sub_questions: q.sub_questions ? JSON.parse(q.sub_questions) : null
    }));
    return jsonResponse(questionsWithParsedJSON);
  } catch (error) {
    return errorResponse(error.message || "\u83B7\u53D6\u9898\u76EE\u5217\u8868\u5931\u8D25", 500);
  }
}
__name(onRequestGet5, "onRequestGet");
async function onRequestPost5(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || user.role !== "teacher" && user.role !== "admin") {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    const body = await request.json();
    if (!body.text || !body.options || body.options.length === 0 || !body.correct_option_id) {
      return errorResponse("\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5", 400);
    }
    const questionId = `question-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    await env.DB.prepare(`
        INSERT INTO question_bank (
          id, teacher_id, text, image_r2_key, options, correct_option_id,
          explanation, type, level, knowledge_point_ids, tags,
          reading_passage, sub_questions, created_at, created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
      questionId,
      user.id,
      body.text,
      body.image_r2_key || null,
      JSON.stringify(body.options),
      body.correct_option_id,
      body.explanation || null,
      body.type || "multiple-choice",
      body.level || null,
      JSON.stringify(body.knowledge_point_ids || []),
      JSON.stringify(body.tags || []),
      body.reading_passage || null,
      body.sub_questions ? JSON.stringify(body.sub_questions) : null,
      Date.now(),
      body.created_by || "manual"
    ).run();
    return jsonResponse({
      id: questionId,
      text: body.text,
      type: body.type || "multiple-choice"
    }, 201);
  } catch (error) {
    return errorResponse(error.message || "\u521B\u5EFA\u9898\u76EE\u5931\u8D25", 500);
  }
}
__name(onRequestPost5, "onRequestPost");
async function onRequestPut3(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/api/questions/");
    const questionId = pathParts[1]?.split("?")[0];
    if (!questionId) {
      return errorResponse("\u7F3A\u5C11\u9898\u76EE ID", 400);
    }
    const question = await env.DB.prepare("SELECT * FROM question_bank WHERE id = ? AND is_deleted = 0").bind(questionId).first();
    if (!question) {
      return errorResponse("\u9898\u76EE\u4E0D\u5B58\u5728", 404);
    }
    if (user.role !== "admin" && question.teacher_id !== user.id) {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    const body = await request.json();
    const updates = [];
    const values = [];
    if (body.text !== void 0) {
      updates.push("text = ?");
      values.push(body.text);
    }
    if (body.image_r2_key !== void 0) {
      updates.push("image_r2_key = ?");
      values.push(body.image_r2_key);
    }
    if (body.options !== void 0) {
      updates.push("options = ?");
      values.push(JSON.stringify(body.options));
    }
    if (body.correct_option_id !== void 0) {
      updates.push("correct_option_id = ?");
      values.push(body.correct_option_id);
    }
    if (body.explanation !== void 0) {
      updates.push("explanation = ?");
      values.push(body.explanation);
    }
    if (body.type !== void 0) {
      updates.push("type = ?");
      values.push(body.type);
    }
    if (body.level !== void 0) {
      updates.push("level = ?");
      values.push(body.level);
    }
    if (body.knowledge_point_ids !== void 0) {
      updates.push("knowledge_point_ids = ?");
      values.push(JSON.stringify(body.knowledge_point_ids));
    }
    if (body.tags !== void 0) {
      updates.push("tags = ?");
      values.push(JSON.stringify(body.tags));
    }
    if (body.reading_passage !== void 0) {
      updates.push("reading_passage = ?");
      values.push(body.reading_passage);
    }
    if (body.sub_questions !== void 0) {
      updates.push("sub_questions = ?");
      values.push(body.sub_questions ? JSON.stringify(body.sub_questions) : null);
    }
    if (updates.length === 0) {
      return errorResponse("\u6CA1\u6709\u8981\u66F4\u65B0\u7684\u5B57\u6BB5", 400);
    }
    values.push(questionId);
    await env.DB.prepare(`UPDATE question_bank SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
    return jsonResponse({ success: true, message: "\u9898\u76EE\u5DF2\u66F4\u65B0" });
  } catch (error) {
    return errorResponse(error.message || "\u66F4\u65B0\u9898\u76EE\u5931\u8D25", 500);
  }
}
__name(onRequestPut3, "onRequestPut");
async function onRequestDelete4(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/api/questions/");
    const questionId = pathParts[1]?.split("?")[0];
    if (!questionId) {
      return errorResponse("\u7F3A\u5C11\u9898\u76EE ID", 400);
    }
    const question = await env.DB.prepare("SELECT * FROM question_bank WHERE id = ? AND is_deleted = 0").bind(questionId).first();
    if (!question) {
      return errorResponse("\u9898\u76EE\u4E0D\u5B58\u5728", 404);
    }
    if (user.role !== "admin" && question.teacher_id !== user.id) {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    await env.DB.prepare("UPDATE question_bank SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?").bind(Date.now(), user.id, questionId).run();
    return jsonResponse({ success: true, message: "\u9898\u76EE\u5DF2\u5220\u9664" });
  } catch (error) {
    return errorResponse(error.message || "\u5220\u9664\u9898\u76EE\u5931\u8D25", 500);
  }
}
__name(onRequestDelete4, "onRequestDelete");

// api/resources/[[id]].ts
async function onRequestGet6(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const url = new URL(request.url);
    const teacherId = url.searchParams.get("teacherId");
    let query;
    if (teacherId) {
      if (user.role !== "teacher" && user.role !== "admin") {
        return errorResponse("\u65E0\u6743\u9650", 403);
      }
      query = env.DB.prepare("SELECT * FROM resources WHERE teacher_id = ? AND is_deleted = 0 ORDER BY created_at DESC").bind(teacherId);
    } else {
      query = env.DB.prepare("SELECT * FROM resources WHERE status = ? AND is_deleted = 0 ORDER BY created_at DESC").bind("ready");
    }
    const { results } = await query.all();
    const resourcesWithParsedJSON = results.map((resource) => ({
      ...resource,
      transcript: JSON.parse(resource.transcript || "[]"),
      raw_azure_words: resource.raw_azure_words ? JSON.parse(resource.raw_azure_words) : null,
      questions: JSON.parse(resource.questions || "[]"),
      assigned_class_ids: JSON.parse(resource.assigned_class_ids || "[]"),
      grammar_tags: JSON.parse(resource.grammar_tags || "[]"),
      vocab_tags: JSON.parse(resource.vocab_tags || "[]")
    }));
    return jsonResponse(resourcesWithParsedJSON);
  } catch (error) {
    console.error("Get resources error:", error);
    return errorResponse("\u83B7\u53D6\u8D44\u6E90\u5931\u8D25", 500);
  }
}
__name(onRequestGet6, "onRequestGet");
async function onRequestPost6(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || user.role !== "teacher") {
      return errorResponse("\u4EC5\u6559\u5E08\u53EF\u521B\u5EFA\u8D44\u6E90", 403);
    }
    const resource = await request.json();
    if (!resource.channel_id || !resource.title || !resource.level || !resource.video_r2_key || !resource.cover_r2_key) {
      return errorResponse("\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5", 400);
    }
    const id = `res-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const now = Date.now();
    await env.DB.prepare(`
        INSERT INTO resources (
          id, channel_id, teacher_id, title, level,
          video_r2_key, audio_r2_key, backing_track_r2_key, vocal_track_r2_key, cover_r2_key,
          transcript, raw_azure_words, questions,
          status, deadline, assigned_class_ids, grammar_tags, vocab_tags,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
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
      resource.status || "draft",
      resource.deadline || null,
      JSON.stringify(resource.assigned_class_ids || []),
      JSON.stringify(resource.grammar_tags || []),
      JSON.stringify(resource.vocab_tags || []),
      now
    ).run();
    return jsonResponse({ id, created_at: now });
  } catch (error) {
    console.error("Create resource error:", error);
    return errorResponse("\u521B\u5EFA\u8D44\u6E90\u5931\u8D25", 500);
  }
}
__name(onRequestPost6, "onRequestPost");
async function onRequestPut4(context) {
  const { request, env, params } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || user.role !== "teacher" && user.role !== "admin") {
      return errorResponse("\u4EC5\u6559\u5E08\u53EF\u66F4\u65B0\u8D44\u6E90", 403);
    }
    const resourceId = params.id;
    const updates = await request.json();
    const existing = await env.DB.prepare("SELECT teacher_id FROM resources WHERE id = ? AND is_deleted = 0").bind(resourceId).first();
    if (!existing) {
      return errorResponse("\u8D44\u6E90\u4E0D\u5B58\u5728", 404);
    }
    if (existing.teacher_id !== user.id && user.role !== "admin") {
      return errorResponse("\u65E0\u6743\u9650\u4FEE\u6539\u6B64\u8D44\u6E90", 403);
    }
    const updateFields = [];
    const values = [];
    if (updates.title !== void 0) {
      updateFields.push("title = ?");
      values.push(updates.title);
    }
    if (updates.level !== void 0) {
      updateFields.push("level = ?");
      values.push(updates.level);
    }
    if (updates.transcript !== void 0) {
      updateFields.push("transcript = ?");
      values.push(JSON.stringify(updates.transcript));
    }
    if (updates.questions !== void 0) {
      updateFields.push("questions = ?");
      values.push(JSON.stringify(updates.questions));
    }
    if (updates.status !== void 0) {
      updateFields.push("status = ?");
      values.push(updates.status);
    }
    if (updateFields.length === 0) {
      return errorResponse("\u6CA1\u6709\u9700\u8981\u66F4\u65B0\u7684\u5B57\u6BB5", 400);
    }
    values.push(resourceId);
    await env.DB.prepare(`UPDATE resources SET ${updateFields.join(", ")} WHERE id = ?`).bind(...values).run();
    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Update resource error:", error);
    return errorResponse("\u66F4\u65B0\u8D44\u6E90\u5931\u8D25", 500);
  }
}
__name(onRequestPut4, "onRequestPut");
async function onRequestDelete5(context) {
  const { request, env, params } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || user.role !== "teacher") {
      return errorResponse("\u4EC5\u6559\u5E08\u53EF\u5220\u9664\u8D44\u6E90", 403);
    }
    const resourceId = params.id;
    await env.DB.prepare("UPDATE resources SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?").bind(Date.now(), user.id, resourceId).run();
    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Delete resource error:", error);
    return errorResponse("\u5220\u9664\u8D44\u6E90\u5931\u8D25", 500);
  }
}
__name(onRequestDelete5, "onRequestDelete");

// api/users/[[id]].ts
async function onRequestGet7(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const url = new URL(request.url);
    const role = url.searchParams.get("role");
    const classId = url.searchParams.get("classId");
    let query;
    if (user.role === "admin") {
      if (role) {
        query = env.DB.prepare("SELECT id, username, role, name, avatar_r2_key, class_id, needs_password_change, is_blocked, created_at FROM users WHERE role = ? AND is_deleted = 0 ORDER BY created_at DESC").bind(role);
      } else {
        query = env.DB.prepare("SELECT id, username, role, name, avatar_r2_key, class_id, needs_password_change, is_blocked, created_at FROM users WHERE is_deleted = 0 ORDER BY created_at DESC");
      }
    } else if (user.role === "teacher") {
      if (classId) {
        query = env.DB.prepare("SELECT id, username, role, name, avatar_r2_key, class_id, created_at FROM users WHERE role = ? AND class_id = ? AND is_deleted = 0 ORDER BY name").bind("student", classId);
      } else {
        return errorResponse("\u9700\u8981\u63D0\u4F9B classId", 400);
      }
    } else {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    const { results } = await query.all();
    return jsonResponse(results);
  } catch (error) {
    return errorResponse(error.message || "\u83B7\u53D6\u7528\u6237\u5217\u8868\u5931\u8D25", 500);
  }
}
__name(onRequestGet7, "onRequestGet");
async function onRequestPost7(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    if (/^\/api\/users\/[^/]+\/change-password\/?$/.test(url.pathname)) {
      return onRequestPost_changePassword(context);
    }
    const user = await getUserFromRequest(request, env);
    if (!user || user.role !== "admin" && user.role !== "teacher") {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    const body = await request.json();
    if (!body.username || body.password === void 0 || body.password === null || !body.role || !body.name) {
      return errorResponse("\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5", 400);
    }
    if (typeof body.password !== "string") {
      return errorResponse("password \u5FC5\u987B\u662F\u5B57\u7B26\u4E32", 400);
    }
    if (user.role === "teacher" && body.role !== "student") {
      return errorResponse("\u6559\u5E08\u53EA\u80FD\u521B\u5EFA\u5B66\u751F\u8D26\u6237", 403);
    }
    const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(body.username).first();
    if (existing) {
      return errorResponse("\u7528\u6237\u540D\u5DF2\u5B58\u5728", 400);
    }
    const userId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const passwordHash = await hashPassword(body.password);
    const needsPasswordChange = body.needsPasswordChange ?? true;
    await env.DB.prepare(`
        INSERT INTO users (id, username, password_hash, role, name, class_id, needs_password_change, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
      userId,
      body.username,
      passwordHash,
      body.role,
      body.name,
      body.classId || null,
      needsPasswordChange ? 1 : 0,
      Date.now()
    ).run();
    return jsonResponse({ id: userId, username: body.username, role: body.role, name: body.name }, 201);
  } catch (error) {
    return errorResponse(error.message || "\u521B\u5EFA\u7528\u6237\u5931\u8D25", 500);
  }
}
__name(onRequestPost7, "onRequestPost");
async function onRequestPut5(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/api/users/");
    const targetUserId = pathParts[1]?.split("?")[0];
    if (!targetUserId) {
      return errorResponse("\u7F3A\u5C11\u7528\u6237 ID", 400);
    }
    const body = await request.json();
    if (user.role !== "admin" && user.id !== targetUserId) {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    const updates = [];
    const values = [];
    if (body.name !== void 0) {
      updates.push("name = ?");
      values.push(body.name);
    }
    if (body.avatar_r2_key !== void 0) {
      updates.push("avatar_r2_key = ?");
      values.push(body.avatar_r2_key);
    }
    if (body.class_id !== void 0 && user.role === "admin") {
      updates.push("class_id = ?");
      values.push(body.class_id);
    }
    if (body.is_blocked !== void 0 && user.role === "admin") {
      updates.push("is_blocked = ?");
      values.push(body.is_blocked ? 1 : 0);
    }
    if (updates.length === 0) {
      return errorResponse("\u6CA1\u6709\u8981\u66F4\u65B0\u7684\u5B57\u6BB5", 400);
    }
    values.push(targetUserId);
    await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
    return jsonResponse({ success: true, message: "\u7528\u6237\u4FE1\u606F\u5DF2\u66F4\u65B0" });
  } catch (error) {
    return errorResponse(error.message || "\u66F4\u65B0\u7528\u6237\u5931\u8D25", 500);
  }
}
__name(onRequestPut5, "onRequestPut");
async function onRequestPost_changePassword(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/api/users/");
    const targetUserId = pathParts[1]?.split("/")[0];
    if (!targetUserId) {
      return errorResponse("\u7F3A\u5C11\u7528\u6237 ID", 400);
    }
    if (user.role !== "admin" && user.id !== targetUserId) {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    const body = await request.json();
    if (!body.newPassword) {
      return errorResponse("\u7F3A\u5C11\u65B0\u5BC6\u7801", 400);
    }
    if (user.role !== "admin") {
      if (!body.oldPassword) {
        return errorResponse("\u7F3A\u5C11\u65E7\u5BC6\u7801", 400);
      }
      const targetUser = await env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(targetUserId).first();
      if (!targetUser) {
        return errorResponse("\u7528\u6237\u4E0D\u5B58\u5728", 404);
      }
      const valid = await verifyPassword(body.oldPassword, targetUser.password_hash);
      if (!valid) {
        return errorResponse("\u65E7\u5BC6\u7801\u9519\u8BEF", 400);
      }
    }
    const newPasswordHash = await hashPassword(body.newPassword);
    const forceTargetChange = user.role === "admin" && user.id !== targetUserId;
    await env.DB.prepare("UPDATE users SET password_hash = ?, needs_password_change = ? WHERE id = ?").bind(newPasswordHash, forceTargetChange ? 1 : 0, targetUserId).run();
    return jsonResponse({ success: true, message: "\u5BC6\u7801\u5DF2\u4FEE\u6539" });
  } catch (error) {
    return errorResponse(error.message || "\u4FEE\u6539\u5BC6\u7801\u5931\u8D25", 500);
  }
}
__name(onRequestPost_changePassword, "onRequestPost_changePassword");
async function onRequestDelete6(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || user.role !== "admin") {
      return errorResponse("\u65E0\u6743\u9650", 403);
    }
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/api/users/");
    const targetUserId = pathParts[1]?.split("?")[0];
    if (!targetUserId) {
      return errorResponse("\u7F3A\u5C11\u7528\u6237 ID", 400);
    }
    await env.DB.prepare("UPDATE users SET is_deleted = 1, deleted_at = ?, deleted_by = ? WHERE id = ?").bind(Date.now(), user.id, targetUserId).run();
    return jsonResponse({ success: true, message: "\u7528\u6237\u5DF2\u5220\u9664" });
  } catch (error) {
    return errorResponse(error.message || "\u5220\u9664\u7528\u6237\u5931\u8D25", 500);
  }
}
__name(onRequestDelete6, "onRequestDelete");

// api/media/[[path]].ts
async function onRequest(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split("/api/media/");
    if (pathParts.length < 2) {
      return errorResponse("\u65E0\u6548\u7684\u6587\u4EF6\u8DEF\u5F84", 400);
    }
    const r2Key = pathParts[1];
    const range = request.headers.get("range");
    let object;
    if (range) {
      const rangeMatch = range.match(/bytes=(\d+)-(\d*)/);
      if (!rangeMatch) {
        return errorResponse("\u65E0\u6548\u7684 Range \u8BF7\u6C42", 400);
      }
      const start = parseInt(rangeMatch[1]);
      const end = rangeMatch[2] ? parseInt(rangeMatch[2]) : void 0;
      object = await env.R2_BUCKET.get(r2Key, {
        range: { offset: start, length: end ? end - start + 1 : void 0 }
      });
    } else {
      object = await env.R2_BUCKET.get(r2Key);
    }
    if (!object) {
      return errorResponse("\u6587\u4EF6\u4E0D\u5B58\u5728", 404);
    }
    const headers = new Headers();
    if (object.httpMetadata?.contentType) {
      headers.set("Content-Type", object.httpMetadata.contentType);
    }
    const folder = r2Key.split("/")[0];
    if (folder === "avatars" || folder === "covers") {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else if (folder === "videos" || folder === "audios") {
      headers.set("Cache-Control", "public, max-age=86400");
    } else {
      headers.set("Cache-Control", "public, max-age=3600");
    }
    if (range && object.range && "offset" in object.range) {
      headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + (object.size || 0) - 1}/${object.size || 0}`);
      headers.set("Content-Length", (object.size || 0).toString());
      headers.set("Accept-Ranges", "bytes");
      return new Response(object.body, {
        status: 206,
        // Partial Content
        headers
      });
    }
    headers.set("Content-Length", (object.size || 0).toString());
    headers.set("Accept-Ranges", "bytes");
    return new Response(object.body, {
      status: 200,
      headers
    });
  } catch (error) {
    console.error("Media proxy error:", error);
    return errorResponse("\u83B7\u53D6\u6587\u4EF6\u5931\u8D25", 500);
  }
}
__name(onRequest, "onRequest");

// api/auth.ts
async function onRequestPost8(context) {
  const { request, env } = context;
  try {
    if (!env.DB) {
      console.error("[AUTH] D1 database not bound!");
      return errorResponse("\u670D\u52A1\u914D\u7F6E\u9519\u8BEF\uFF1A\u6570\u636E\u5E93\u672A\u7ED1\u5B9A", 500);
    }
    if (!env.JWT_SECRET) {
      console.error("[AUTH] JWT_SECRET not configured!");
      return errorResponse("\u670D\u52A1\u914D\u7F6E\u9519\u8BEF\uFF1AJWT\u5BC6\u94A5\u672A\u8BBE\u7F6E", 500);
    }
    const { username, password } = await request.json();
    if (!username || !password) {
      return errorResponse("\u7528\u6237\u540D\u548C\u5BC6\u7801\u4E0D\u80FD\u4E3A\u7A7A", 400);
    }
    const user = await env.DB.prepare("SELECT * FROM users WHERE username = ? AND is_deleted = 0").bind(username).first();
    if (!user) {
      console.log(`[AUTH] User not found: ${username}`);
      return errorResponse("\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF", 401);
    }
    if (user.is_blocked) {
      console.log(`[AUTH] User blocked: ${username}`);
      return errorResponse("\u8D26\u53F7\u5DF2\u88AB\u5C01\u7981", 403);
    }
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      console.log(`[AUTH] Invalid password for user: ${username}`);
      return errorResponse("\u7528\u6237\u540D\u6216\u5BC6\u7801\u9519\u8BEF", 401);
    }
    const token = await generateJWT(user, env.JWT_SECRET);
    const { password_hash, ...userWithoutPassword } = user;
    return jsonResponse({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error("[AUTH] Login error:", error);
    return errorResponse(`\u767B\u5F55\u5931\u8D25: ${error instanceof Error ? error.message : String(error)}`, 500);
  }
}
__name(onRequestPost8, "onRequestPost");
async function onRequestGet8(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const { password_hash, ...userWithoutPassword } = user;
    return jsonResponse(userWithoutPassword);
  } catch (error) {
    console.error("Get user error:", error);
    return errorResponse("\u83B7\u53D6\u7528\u6237\u4FE1\u606F\u5931\u8D25", 500);
  }
}
__name(onRequestGet8, "onRequestGet");

// api/diag.ts
async function onRequestGet9(context) {
  const { env } = context;
  try {
    const dbBound = !!env.DB;
    const jwtConfigured = !!env.JWT_SECRET;
    let userCount = null;
    let hasAdmin = null;
    let hasTeacher = null;
    let hasStudent = null;
    if (dbBound) {
      const countRow = await env.DB.prepare("SELECT COUNT(1) as c FROM users").first();
      userCount = Number(countRow?.c ?? 0);
      const adminRow = await env.DB.prepare("SELECT 1 as ok FROM users WHERE username = ? LIMIT 1").bind("admin").first();
      hasAdmin = !!adminRow?.ok;
      const teacherRow = await env.DB.prepare("SELECT 1 as ok FROM users WHERE username = ? LIMIT 1").bind("teacher").first();
      hasTeacher = !!teacherRow?.ok;
      const studentRow = await env.DB.prepare("SELECT 1 as ok FROM users WHERE username = ? LIMIT 1").bind("student").first();
      hasStudent = !!studentRow?.ok;
    }
    return jsonResponse({
      ok: true,
      env: {
        dbBound,
        jwtConfigured
      },
      users: {
        userCount,
        hasAdmin,
        hasTeacher,
        hasStudent
      }
    });
  } catch (e) {
    console.error("[DIAG] error:", e);
    return errorResponse("diag failed", 500);
  }
}
__name(onRequestGet9, "onRequestGet");

// api/proxy-gemini.ts
async function onRequestPost9(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const keyRecord = await env.DB.prepare("SELECT gemini_key_encrypted FROM user_api_keys WHERE user_id = ?").bind(user.id).first();
    if (!keyRecord?.gemini_key_encrypted) {
      return errorResponse("\u672A\u914D\u7F6E Gemini API Key\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u6DFB\u52A0", 400);
    }
    const apiKey = await decryptApiKey(keyRecord.gemini_key_encrypted, env.GEMINI_MASTER_KEY || "");
    const body = await request.json();
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify(body)
      }
    );
    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error("Gemini API error:", errorText);
      if (errorText.includes("API key not valid")) {
        return errorResponse("Gemini API Key \u65E0\u6548\uFF0C\u8BF7\u5728\u8BBE\u7F6E\u4E2D\u66F4\u65B0", 400);
      }
      if (errorText.includes("quota")) {
        return errorResponse("Gemini API \u914D\u989D\u5DF2\u7528\u5C3D", 429);
      }
      return errorResponse("Gemini API \u8C03\u7528\u5931\u8D25: " + errorText, geminiResponse.status);
    }
    const responseData = await geminiResponse.json();
    return jsonResponse(responseData);
  } catch (error) {
    console.error("Gemini proxy error:", error);
    return errorResponse("\u4EE3\u7406\u8BF7\u6C42\u5931\u8D25", 500);
  }
}
__name(onRequestPost9, "onRequestPost");

// api/upload.ts
async function onRequestPost10(context) {
  const { request, env } = context;
  try {
    const user = await getUserFromRequest(request, env);
    if (!user) {
      return errorResponse("\u672A\u6388\u6743", 401);
    }
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = formData.get("folder");
    if (!file) {
      return errorResponse("\u7F3A\u5C11\u6587\u4EF6", 400);
    }
    if (!folder || !["avatars", "videos", "audios", "covers", "recordings", "questions"].includes(folder)) {
      return errorResponse("\u65E0\u6548\u7684\u6587\u4EF6\u5939\u7C7B\u578B", 400);
    }
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const extension = file.name.split(".").pop() || "bin";
    const r2Key = `${folder}/${user.id}/${timestamp}_${randomId}.${extension}`;
    await env.R2_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type || "application/octet-stream"
      },
      customMetadata: {
        uploadedBy: user.id,
        uploadedAt: timestamp.toString(),
        originalName: file.name
      }
    });
    const cdnUrl = `/api/media/${r2Key}`;
    const result = {
      r2_key: r2Key,
      cdn_url: cdnUrl,
      size: file.size
    };
    return jsonResponse(result);
  } catch (error) {
    console.error("Upload error:", error);
    return errorResponse("\u4E0A\u4F20\u5931\u8D25", 500);
  }
}
__name(onRequestPost10, "onRequestPost");

// api/import.ts
async function onRequest2(context) {
  const { request, env } = context;
  if (request.method !== "POST") {
    return errorResponse("\u53EA\u652F\u6301 POST \u65B9\u6CD5", 405);
  }
  try {
    const user = await getUserFromRequest(request, env);
    if (!user || user.role !== "admin") {
      return errorResponse("\u53EA\u6709\u7BA1\u7406\u5458\u53EF\u4EE5\u6279\u91CF\u5BFC\u5165\u6570\u636E", 403);
    }
    const body = await request.json();
    if (!body.type || !body.data || !Array.isArray(body.data)) {
      return errorResponse("\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5\u6216\u6570\u636E\u683C\u5F0F\u9519\u8BEF", 400);
    }
    const results = {
      total: body.data.length,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };
    switch (body.type) {
      case "users":
        await importUsers(env, body.data, body.options || {}, results);
        break;
      case "resources":
        await importResources(env, body.data, body.options || {}, results, user.id);
        break;
      case "questions":
        await importQuestions(env, body.data, body.options || {}, results, user.id);
        break;
      case "exams":
        await importExams(env, body.data, body.options || {}, results, user.id);
        break;
      case "classrooms":
        await importClassrooms(env, body.data, body.options || {}, results, user.id);
        break;
      default:
        return errorResponse("\u4E0D\u652F\u6301\u7684\u5BFC\u5165\u7C7B\u578B", 400);
    }
    return jsonResponse(results);
  } catch (error) {
    return errorResponse(error.message || "\u6279\u91CF\u5BFC\u5165\u5931\u8D25", 500);
  }
}
__name(onRequest2, "onRequest");
async function importUsers(env, users, options, results) {
  for (let i = 0; i < users.length; i++) {
    const userData = users[i];
    try {
      if (!userData.username || !userData.password || !userData.role || !userData.name) {
        results.errors.push({ index: i, error: "\u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5" });
        results.skipped++;
        continue;
      }
      const existing = await env.DB.prepare("SELECT id FROM users WHERE username = ?").bind(userData.username).first();
      if (existing) {
        if (options.skipExisting) {
          results.skipped++;
          continue;
        } else if (options.updateExisting) {
          const updates = [];
          const values = [];
          if (userData.name) {
            updates.push("name = ?");
            values.push(userData.name);
          }
          if (userData.role) {
            updates.push("role = ?");
            values.push(userData.role);
          }
          if (userData.class_id !== void 0) {
            updates.push("class_id = ?");
            values.push(userData.class_id);
          }
          values.push(existing.id);
          await env.DB.prepare(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`).bind(...values).run();
          results.updated++;
          continue;
        } else {
          results.errors.push({ index: i, error: "\u7528\u6237\u540D\u5DF2\u5B58\u5728" });
          results.skipped++;
          continue;
        }
      }
      const userId = userData.id || `user-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const passwordHash = await hashPassword(userData.password);
      await env.DB.prepare(`
          INSERT INTO users (id, username, password_hash, role, name, class_id, avatar_r2_key, needs_password_change, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
        userId,
        userData.username,
        passwordHash,
        userData.role,
        userData.name,
        userData.class_id || null,
        userData.avatar_r2_key || null,
        userData.needs_password_change || 0,
        userData.created_at || Date.now()
      ).run();
      results.created++;
    } catch (error) {
      results.errors.push({ index: i, error: error.message });
      results.skipped++;
    }
  }
}
__name(importUsers, "importUsers");
async function importResources(env, resources, options, results, importerId) {
  for (let i = 0; i < resources.length; i++) {
    const resData = resources[i];
    try {
      const resourceId = resData.id || `resource-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const existing = await env.DB.prepare("SELECT id FROM resources WHERE id = ?").bind(resourceId).first();
      if (existing) {
        if (options.skipExisting) {
          results.skipped++;
          continue;
        }
      }
      await env.DB.prepare(`
          INSERT OR REPLACE INTO resources (
            id, channel_id, teacher_id, title, level,
            video_r2_key, audio_r2_key, backing_track_r2_key, vocal_track_r2_key, cover_r2_key,
            transcript, raw_azure_words, questions,
            status, deadline, assigned_class_ids, grammar_tags, vocab_tags, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
        resourceId,
        resData.channel_id || "default-channel",
        resData.teacher_id || importerId,
        resData.title,
        resData.level || "B1",
        resData.video_r2_key || "",
        resData.audio_r2_key || null,
        resData.backing_track_r2_key || null,
        resData.vocal_track_r2_key || null,
        resData.cover_r2_key || "",
        typeof resData.transcript === "string" ? resData.transcript : JSON.stringify(resData.transcript || []),
        resData.raw_azure_words ? typeof resData.raw_azure_words === "string" ? resData.raw_azure_words : JSON.stringify(resData.raw_azure_words) : null,
        typeof resData.questions === "string" ? resData.questions : JSON.stringify(resData.questions || []),
        resData.status || "draft",
        resData.deadline || null,
        typeof resData.assigned_class_ids === "string" ? resData.assigned_class_ids : JSON.stringify(resData.assigned_class_ids || []),
        typeof resData.grammar_tags === "string" ? resData.grammar_tags : JSON.stringify(resData.grammar_tags || []),
        typeof resData.vocab_tags === "string" ? resData.vocab_tags : JSON.stringify(resData.vocab_tags || []),
        resData.created_at || Date.now()
      ).run();
      results.created++;
    } catch (error) {
      results.errors.push({ index: i, error: error.message });
      results.skipped++;
    }
  }
}
__name(importResources, "importResources");
async function importQuestions(env, questions, options, results, importerId) {
  for (let i = 0; i < questions.length; i++) {
    const qData = questions[i];
    try {
      const questionId = qData.id || `question-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      await env.DB.prepare(`
          INSERT OR REPLACE INTO question_bank (
            id, teacher_id, text, image_r2_key, options, correct_option_id,
            explanation, type, level, knowledge_point_ids, tags,
            reading_passage, sub_questions, created_at, created_by
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
        questionId,
        qData.teacher_id || importerId,
        qData.text,
        qData.image_r2_key || null,
        typeof qData.options === "string" ? qData.options : JSON.stringify(qData.options || []),
        qData.correct_option_id,
        qData.explanation || null,
        qData.type || "multiple-choice",
        qData.level || null,
        typeof qData.knowledge_point_ids === "string" ? qData.knowledge_point_ids : JSON.stringify(qData.knowledge_point_ids || []),
        typeof qData.tags === "string" ? qData.tags : JSON.stringify(qData.tags || []),
        qData.reading_passage || null,
        qData.sub_questions ? typeof qData.sub_questions === "string" ? qData.sub_questions : JSON.stringify(qData.sub_questions) : null,
        qData.created_at || Date.now(),
        "import"
      ).run();
      results.created++;
    } catch (error) {
      results.errors.push({ index: i, error: error.message });
      results.skipped++;
    }
  }
}
__name(importQuestions, "importQuestions");
async function importExams(env, exams, options, results, importerId) {
  for (let i = 0; i < exams.length; i++) {
    const examData = exams[i];
    try {
      const examId = examData.id || `exam-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      await env.DB.prepare(`
          INSERT OR REPLACE INTO exam_papers (
            id, teacher_id, title, sections, total_score,
            assigned_class_ids, assigned_class_deadlines, exam_taker_settings, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
        examId,
        examData.teacher_id || importerId,
        examData.title,
        typeof examData.sections === "string" ? examData.sections : JSON.stringify(examData.sections || []),
        examData.total_score || 0,
        typeof examData.assigned_class_ids === "string" ? examData.assigned_class_ids : JSON.stringify(examData.assigned_class_ids || []),
        typeof examData.assigned_class_deadlines === "string" ? examData.assigned_class_deadlines : JSON.stringify(examData.assigned_class_deadlines || {}),
        examData.exam_taker_settings ? typeof examData.exam_taker_settings === "string" ? examData.exam_taker_settings : JSON.stringify(examData.exam_taker_settings) : null,
        examData.created_at || Date.now()
      ).run();
      results.created++;
    } catch (error) {
      results.errors.push({ index: i, error: error.message });
      results.skipped++;
    }
  }
}
__name(importExams, "importExams");
async function importClassrooms(env, classrooms, options, results, importerId) {
  for (let i = 0; i < classrooms.length; i++) {
    const classData = classrooms[i];
    try {
      const classId = classData.id || `class-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const students = Array.isArray(classData.students) ? classData.students : [];
      await env.DB.prepare(`
          INSERT OR REPLACE INTO classrooms (
            id, user_id, name, student_count, students, created_at
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
        classId,
        classData.user_id || importerId,
        classData.name,
        students.length,
        JSON.stringify(students),
        classData.created_at || Date.now()
      ).run();
      results.created++;
    } catch (error) {
      results.errors.push({ index: i, error: error.message });
      results.skipped++;
    }
  }
}
__name(importClassrooms, "importClassrooms");

// _middleware.ts
async function onRequest3(context) {
  const { request, next, env } = context;
  if (request.method === "OPTIONS") {
    return handleOptions(request);
  }
  try {
    const response = await next();
    const newHeaders = new Headers(response.headers);
    const origin = request.headers.get("Origin");
    if (origin) {
      Object.entries(corsHeaders(origin)).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  } catch (error) {
    console.error("Middleware error:", error);
    return errorResponse("Internal server error", 500);
  }
}
__name(onRequest3, "onRequest");

// ../.wrangler/tmp/pages-o3Py2j/functionsRoutes-0.408772260136151.mjs
var routes = [
  {
    routePath: "/api/users/:id/api-keys",
    mountPath: "/api/users/:id",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/users/:id/api-keys",
    mountPath: "/api/users/:id",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/users/:id/api-keys",
    mountPath: "/api/users/:id",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut]
  },
  {
    routePath: "/api/users/:id/change-password",
    mountPath: "/api/users/:id",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/classrooms/:id*",
    mountPath: "/api/classrooms",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete2]
  },
  {
    routePath: "/api/classrooms/:id*",
    mountPath: "/api/classrooms",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/classrooms/:id*",
    mountPath: "/api/classrooms",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/classrooms/:id*",
    mountPath: "/api/classrooms",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut2]
  },
  {
    routePath: "/api/exams/:id*",
    mountPath: "/api/exams",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/exams/:id*",
    mountPath: "/api/exams",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/practice/:id*",
    mountPath: "/api/practice",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete3]
  },
  {
    routePath: "/api/practice/:id*",
    mountPath: "/api/practice",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/practice/:id*",
    mountPath: "/api/practice",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/questions/:id*",
    mountPath: "/api/questions",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete4]
  },
  {
    routePath: "/api/questions/:id*",
    mountPath: "/api/questions",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/questions/:id*",
    mountPath: "/api/questions",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/questions/:id*",
    mountPath: "/api/questions",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut3]
  },
  {
    routePath: "/api/resources/:id*",
    mountPath: "/api/resources",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete5]
  },
  {
    routePath: "/api/resources/:id*",
    mountPath: "/api/resources",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/resources/:id*",
    mountPath: "/api/resources",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/resources/:id*",
    mountPath: "/api/resources",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut4]
  },
  {
    routePath: "/api/users/:id*",
    mountPath: "/api/users",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete6]
  },
  {
    routePath: "/api/users/:id*",
    mountPath: "/api/users",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/api/users/:id*",
    mountPath: "/api/users",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  },
  {
    routePath: "/api/users/:id*",
    mountPath: "/api/users",
    method: "PUT",
    middlewares: [],
    modules: [onRequestPut5]
  },
  {
    routePath: "/api/media/:path*",
    mountPath: "/api/media",
    method: "",
    middlewares: [],
    modules: [onRequest]
  },
  {
    routePath: "/api/auth",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet8]
  },
  {
    routePath: "/api/auth",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost8]
  },
  {
    routePath: "/api/diag",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet9]
  },
  {
    routePath: "/api/proxy-gemini",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost9]
  },
  {
    routePath: "/api/upload",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost10]
  },
  {
    routePath: "/api/import",
    mountPath: "/api",
    method: "",
    middlewares: [],
    modules: [onRequest2]
  },
  {
    routePath: "/",
    mountPath: "/",
    method: "",
    middlewares: [onRequest3],
    modules: []
  }
];

// ../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-edWscI/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-edWscI/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.5703263507777492.mjs.map
