-- Migration: Add redo_mode field to exam_sessions table
-- This field determines how a returned-for-redo exam should be handled:
-- 'clear' - Clear all answers, student starts fresh (default, backward compatible)
-- 'revise' - Preserve answers, student can modify and resubmit

ALTER TABLE exam_sessions ADD COLUMN redo_mode TEXT;

-- Note: existing deleted sessions will have NULL redo_mode, 
-- which should be treated as 'clear' for backward compatibility
