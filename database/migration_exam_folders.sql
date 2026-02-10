
-- 创建缺失的 exam_folders 表
CREATE TABLE IF NOT EXISTS exam_folders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
    is_deleted INTEGER DEFAULT 0,
    deleted_at INTEGER,
    deleted_by TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_exam_folders_user ON exam_folders(user_id, is_deleted);
