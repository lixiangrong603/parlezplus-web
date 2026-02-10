// Cloudflare Workers 环境类型定义

export interface Env {
  // D1 数据库绑定
  DB: D1Database;
  
  // R2 存储桶绑定
  R2_BUCKET: R2Bucket;
  
  // KV 命名空间绑定
  KV: KVNamespace;
  
  // 环境变量
  ENVIRONMENT: string;
  
  // 敏感密钥 (通过 wrangler secret put 设置)
  GEMINI_MASTER_KEY?: string;
  AZURE_MASTER_KEY?: string;
  JWT_SECRET: string;
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  username: string;
  role: 'student' | 'teacher' | 'admin';
  iat: number;
  exp: number;
}

// API 响应统一格式
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 用户对象
export interface User {
  id: string;
  username: string;
  password_hash: string; // 密码哈希（仅用于数据库查询，不返回给前端）
  role: 'student' | 'teacher' | 'admin';
  name: string;
  avatar_r2_key: string | null;
  class_id: string | null;
  needs_password_change: number;
  is_blocked: number;
  created_at: number;
  is_deleted?: number;
  deleted_at?: number;
  deleted_by?: string;
}

// 班级对象
export interface Classroom {
  id: string;
  user_id: string;
  name: string;
  student_count: number;
  students: string; // JSON
  created_at: number;
  is_deleted: number;
  deleted_at: number | null;
  deleted_by: string | null;
}

// 频道对象
export interface Channel {
  id: string;
  user_id: string;
  name: string;
  created_at: number;
  is_deleted: number;
  deleted_at: number | null;
  deleted_by: string | null;
}

// 课程大纲对象
export interface SyllabusCourse {
  id: string;
  user_id: string;
  name: string;
  units: string; // JSON
  created_at: number;
  is_deleted: number;
  deleted_at: number | null;
  deleted_by: string | null;
}

// 资源对象
export interface Resource {
  id: string;
  channel_id: string;
  teacher_id: string;
  title: string;
  level: string;
  video_r2_key: string;
  audio_r2_key: string | null;
  backing_track_r2_key: string | null;
  vocal_track_r2_key: string | null;
  cover_r2_key: string;
  transcript: string; // JSON
  raw_azure_words: string | null; // JSON
  questions: string; // JSON
  status: 'draft' | 'ready';
  deadline: number | null;
  assigned_class_ids: string; // JSON
  grammar_tags: string; // JSON
  vocab_tags: string; // JSON
  created_at: number;
  is_deleted: number;
  deleted_at: number | null;
  deleted_by: string | null;
}

// 题目对象
export interface Question {
  id: string;
  teacher_id: string;
  text: string;
  image_r2_key: string | null;
  options: string; // JSON
  correct_option_id: string;
  explanation: string | null;
  type: string;
  level: string | null;
  knowledge_point_ids: string; // JSON
  tags: string; // JSON
  reading_passage: string | null;
  sub_questions: string | null; // JSON
  created_at: number;
  created_by: string;
  is_deleted: number;
  deleted_at: number | null;
  deleted_by: string | null;
}

// 试卷文件夹对象
export interface ExamFolder {
  id: string;
  user_id: string;
  name: string;
  created_at: number;
  is_deleted: number;
  deleted_at: number | null;
  deleted_by: string | null;
}

// 试卷对象
export interface ExamPaper {
  id: string;
  teacher_id: string;
  title: string;
  sections: string; // JSON
  total_score: number;
  assigned_class_ids: string; // JSON
  assigned_class_deadlines: string; // JSON
  exam_taker_settings: string | null; // JSON
  folder_id: string | null; // 文件夹ID
  created_at: number;
  is_deleted: number;
  deleted_at: number | null;
  deleted_by: string | null;
}

// 考试会话对象
export interface ExamSession {
  id: string;
  exam_paper_id: string;
  exam_title: string;
  student_id: string;
  student_name: string;
  answers: string; // JSON
  start_time: number;
  submit_time: number | null;
  elapsed_time: number;
  score: number | null;
  total_score: number;
  is_submitted: number;
  teacher_feedback: string | null;
  manual_score: number | null;
  item_scores: string | null; // JSON
  graded_by: string | null;
  graded_at: number | null;
  status: string;
  is_deleted: number;
  deleted_at: number | null;
  deleted_by: string | null;
  deleted_reason: string | null;
}

// 练习数据对象
export interface PracticeData {
  id: string;
  user_id: string;
  resource_id: string;
  quiz_answers: string | null; // JSON
  quiz_score: string | null; // JSON
  cloze_answers: string | null; // JSON
  cloze_score: string | null; // JSON
  segment_recordings: string; // JSON
  segment_scores: string; // JSON
  full_recording_r2_key: string | null;
  overall_score: string | null; // JSON
  last_updated: number;
  is_deleted: number;
  deleted_at: number | null;
  deleted_by: string | null;
}

// 提交记录对象
export interface Submission {
  id: string;
  student_id: string;
  resource_id: string;
  audio_r2_key: string;
  ai_score: string | null; // JSON
  ai_segment_evals: string | null; // JSON
  teacher_feedback: string | null;
  quiz_result: string | null; // JSON
  cloze_result: string | null; // JSON
  status: 'pending_review' | 'graded';
  submitted_at: number;
  is_deleted: number;
  deleted_at: number | null;
  deleted_by: string | null;
}

// 操作日志对象
export interface OperationLog {
  id: string;
  operator_id: string;
  operator_name: string;
  operation_type: string;
  target_id: string;
  target_type: string;
  target_name?: string;
  reason?: string;
  details?: string;
  timestamp: number;
}

// R2 上传结果
export interface UploadResult {
  r2_key: string;
  cdn_url: string;
  size: number;
}

// 请求上下文 (扩展标准 EventContext)
export interface RequestContext {
  request: Request;
  env: Env;
  user?: User;
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}
