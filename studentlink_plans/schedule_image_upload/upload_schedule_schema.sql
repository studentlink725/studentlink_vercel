-- ============================================================
-- StudentLink Database Migration: Schedule Image Upload Support
-- ============================================================
-- Description: Adds a column to the students table to store the 
--              uploaded schedule image (base64 encoded data URI or URL).
-- ============================================================

-- 1. Add schedule_image column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS schedule_image TEXT;

-- 2. Verify column is added (documentation only)
-- The students table has existing RLS policies that allow authenticated 
-- users to update their own profile columns. No new policies are required.
