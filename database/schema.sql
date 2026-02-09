-- ParlezPlus D1 数据库 Schema
-- 执行: npx wrangler d1 execute parlezplus_db --file=database/schema.sql

-- ============================================
-- 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('student', 'teacher', 'admin')) NOT NULL,
    name TEXT NOT NULL,
    avatar_r2_key TEXT,
    class_id TEXT,
    needs_password_change INTEGER DEFAULT 0,
    is_blocked INTEGER DEFAULT 0,
    is_deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role, is_deleted);
CREATE INDEX IF NOT EXISTS idx_users_class ON users(class_id);

-- ============================================
-- 班级表
-- ============================================
CREATE TABLE IF NOT EXISTS classrooms (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    student_count INTEGER DEFAULT 0,
    students TEXT NOT NULL DEFAULT '[]', -- JSON 数组: [{id, name, avatar_r2_key?, userId}]
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    is_deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_classrooms_user ON classrooms(user_id, is_deleted);

-- ============================================
-- 频道表
-- ============================================
CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    is_deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_channels_user ON channels(user_id, is_deleted);

-- ============================================
-- 资源表 (音视频)
-- ============================================
CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    channel_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    title TEXT NOT NULL,
    level TEXT CHECK(level IN ('A1','A2','B1','B2','C1','C2')) NOT NULL,
    
    -- 媒体文件存储在 R2
    video_r2_key TEXT NOT NULL,
    audio_r2_key TEXT,
    backing_track_r2_key TEXT,
    vocal_track_r2_key TEXT,
    cover_r2_key TEXT NOT NULL,
    
    -- JSON 数据
    transcript TEXT NOT NULL DEFAULT '[]', -- JSON 数组
    raw_azure_words TEXT, -- JSON 数组
    questions TEXT DEFAULT '[]', -- JSON 数组
    
    -- 状态和分配
    status TEXT CHECK(status IN ('draft', 'ready')) DEFAULT 'draft',
    deadline INTEGER,
    assigned_class_ids TEXT DEFAULT '[]', -- JSON 数组
    grammar_tags TEXT DEFAULT '[]', -- JSON 数组
    vocab_tags TEXT DEFAULT '[]', -- JSON 数组
    
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    is_deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT,
    FOREIGN KEY (channel_id) REFERENCES channels(id),
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_resources_teacher ON resources(teacher_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_resources_channel ON resources(channel_id);
CREATE INDEX IF NOT EXISTS idx_resources_status ON resources(status, is_deleted);

-- ============================================
-- 学生练习数据表
-- ============================================
CREATE TABLE IF NOT EXISTS student_practice_data (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    
    -- 答题和分数 (JSON)
    quiz_answers TEXT, -- JSON
    quiz_score TEXT, -- JSON
    cloze_answers TEXT, -- JSON
    cloze_score TEXT, -- JSON
    
    -- 录音存储在 R2
    segment_recordings TEXT DEFAULT '{}', -- JSON: {segmentId: r2_key}
    segment_scores TEXT DEFAULT '{}', -- JSON
    full_recording_r2_key TEXT,
    overall_score TEXT, -- JSON
    
    last_updated INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    is_deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT,
    
    UNIQUE(user_id, resource_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (resource_id) REFERENCES resources(id)
);

CREATE INDEX IF NOT EXISTS idx_practice_user ON student_practice_data(user_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_practice_resource ON student_practice_data(resource_id);

-- ============================================
-- 作业提交表
-- ============================================
CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    
    -- 录音存储在 R2
    audio_r2_key TEXT NOT NULL,
    
    -- AI 评分 (JSON)
    ai_score TEXT, -- JSON
    ai_segment_evals TEXT, -- JSON
    
    -- 教师反馈
    teacher_feedback TEXT,
    
    -- 测验结果 (JSON)
    quiz_result TEXT, -- JSON
    cloze_result TEXT, -- JSON
    
    status TEXT CHECK(status IN ('pending_review', 'graded')) DEFAULT 'pending_review',
    submitted_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    
    is_deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (resource_id) REFERENCES resources(id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_submissions_resource ON submissions(resource_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status, is_deleted);

-- ============================================
-- 课程大纲表
-- ============================================
CREATE TABLE IF NOT EXISTS syllabus_courses (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    units TEXT NOT NULL DEFAULT '[]', -- JSON 数组: [{id, name, knowledgePoints: [{id, name, type}]}]
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    is_deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_syllabus_user ON syllabus_courses(user_id, is_deleted);

-- ============================================
-- 题库表
-- ============================================
CREATE TABLE IF NOT EXISTS question_bank (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    text TEXT NOT NULL,
    image_r2_key TEXT,
    options TEXT NOT NULL DEFAULT '[]', -- JSON 数组: [{id, text, imageUrl_r2_key?}]
    correct_option_id TEXT NOT NULL,
    explanation TEXT,
    type TEXT DEFAULT 'multiple-choice',
    level TEXT,
    knowledge_point_ids TEXT DEFAULT '[]', -- JSON 数组
    tags TEXT DEFAULT '[]', -- JSON 数组
    reading_passage TEXT,
    sub_questions TEXT, -- JSON 数组
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    created_by TEXT DEFAULT 'manual',
    is_deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_questions_teacher ON question_bank(teacher_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_questions_type ON question_bank(type, is_deleted);
CREATE INDEX IF NOT EXISTS idx_questions_level ON question_bank(level, is_deleted);

-- ============================================
-- 试卷表
-- ============================================
CREATE TABLE IF NOT EXISTS exam_papers (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    title TEXT NOT NULL,
    sections TEXT NOT NULL DEFAULT '[]', -- JSON 数组
    total_score REAL NOT NULL,
    assigned_class_ids TEXT DEFAULT '[]', -- JSON 数组
    assigned_class_deadlines TEXT DEFAULT '{}', -- JSON 对象
    exam_taker_settings TEXT, -- JSON
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    is_deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_exams_teacher ON exam_papers(teacher_id, is_deleted);

-- ============================================
-- 考试会话表
-- ============================================
CREATE TABLE IF NOT EXISTS exam_sessions (
    id TEXT PRIMARY KEY,
    exam_paper_id TEXT NOT NULL,
    exam_title TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    answers TEXT NOT NULL DEFAULT '{}', -- JSON 对象
    start_time INTEGER NOT NULL,
    submit_time INTEGER,
    elapsed_time INTEGER NOT NULL,
    score REAL,
    total_score REAL NOT NULL,
    is_submitted INTEGER DEFAULT 0,
    teacher_feedback TEXT,
    manual_score REAL,
    item_scores TEXT, -- JSON
    graded_by TEXT,
    graded_at INTEGER,
    status TEXT DEFAULT 'pending',
    is_deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT,
    deleted_reason TEXT,
    FOREIGN KEY (exam_paper_id) REFERENCES exam_papers(id),
    FOREIGN KEY (student_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_student ON exam_sessions(student_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_sessions_paper ON exam_sessions(exam_paper_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON exam_sessions(status, is_deleted);

-- ============================================
-- 操作日志表
-- ============================================
CREATE TABLE IF NOT EXISTS operation_logs (
    id TEXT PRIMARY KEY,
    operator_id TEXT NOT NULL,
    operator_name TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_name TEXT,
    reason TEXT,
    details TEXT, -- JSON 字符串
    timestamp INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    FOREIGN KEY (operator_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_logs_operator ON operation_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_logs_type ON operation_logs(operation_type);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON operation_logs(timestamp);

-- ============================================
-- 用户 API 密钥表 (加密存储)
-- ============================================
CREATE TABLE IF NOT EXISTS user_api_keys (
    user_id TEXT PRIMARY KEY,
    gemini_key_encrypted TEXT,
    azure_key_encrypted TEXT,
    azure_region TEXT DEFAULT 'westeurope',
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- 默认管理员账户 (首次部署后应修改密码)
-- 密码: admin123 (需要替换为 bcrypt hash)
-- ============================================
INSERT OR IGNORE INTO users (id, username, password_hash, role, name, needs_password_change, created_at)
VALUES ('admin-001', 'admin', '$2a$10$placeholder_hash_replace_me', 'admin', '系统管理员', 1, strftime('%s', 'now') * 1000);
