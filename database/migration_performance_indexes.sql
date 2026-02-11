-- ParlezPlus 性能优化索引
-- 执行: npx wrangler d1 execute parlezplus_db --file=database/migration_performance_indexes.sql

-- ============================================
-- 考试会话表复合索引优化
-- 用于批量查询特定考试+特定学生的会话
-- ============================================
CREATE INDEX IF NOT EXISTS idx_sessions_paper_student_deleted 
ON exam_sessions(exam_paper_id, student_id, is_deleted);

-- 用于按提交时间排序的考试会话查询
CREATE INDEX IF NOT EXISTS idx_sessions_paper_time 
ON exam_sessions(exam_paper_id, start_time DESC);

-- ============================================
-- 资源表索引优化
-- 用于教师按创建时间获取资源列表
-- ============================================
CREATE INDEX IF NOT EXISTS idx_resources_teacher_time 
ON resources(teacher_id, is_deleted, created_at DESC);

-- ============================================
-- 作业提交表复合索引
-- 用于按资源和学生查询提交
-- ============================================
CREATE INDEX IF NOT EXISTS idx_submissions_resource_student 
ON submissions(resource_id, student_id, is_deleted);

-- 用于按状态查询待批改的提交
CREATE INDEX IF NOT EXISTS idx_submissions_status_time 
ON submissions(status, is_deleted, submitted_at DESC);

-- ============================================
-- 用户表索引优化
-- 用于按班级查询学生
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_class_deleted 
ON users(class_id, is_deleted, role);

-- ============================================
-- 说明
-- ============================================
-- 这些索引优化了以下常见查询场景:
-- 1. 批量获取多个考试的会话 (班级管理页面)
-- 2. 资源列表按时间排序 (资源管理页面)
-- 3. 按学生/资源查询提交 (作业批改页面)
-- 4. 按班级查询学生列表 (班级管理页面)
