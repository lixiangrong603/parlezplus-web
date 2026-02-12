-- 迁移脚本：为 exam_papers 表添加考试说明字段
-- 用于存储教师设置的考试说明文本

ALTER TABLE exam_papers ADD COLUMN instructions TEXT;
