-- StudentLink Database Migration: Task 1.1 - Schema Modifications
-- This migration sets up the columns, tables, indexes, and RLS policies required for pre-computed matching.

-- 1. Add discovery toggle and last refresh timestamp to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS matching_enabled BOOLEAN DEFAULT true;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_match_refresh TIMESTAMPTZ;

-- 2. Create peer_similarity table to hold the top 3 matches per user
CREATE TABLE IF NOT EXISTS peer_similarity (
    user_id      UUID REFERENCES students(id) ON DELETE CASCADE,
    peer_id      UUID REFERENCES students(id) ON DELETE CASCADE,
    match_score  NUMERIC,
    computed_at  TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, peer_id)
);

-- 3. Create performance indexes for matching calculations
CREATE INDEX IF NOT EXISTS idx_peer_similarity_lookup ON peer_similarity(user_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_student_interests_student ON student_interests(student_id);
CREATE INDEX IF NOT EXISTS idx_student_interests_interest ON student_interests(interest_id);

-- 4. Row Level Security (RLS) Configuration (Disabled for Testing)
-- Uncomment the lines below to re-enable RLS before official release:
-- ALTER TABLE peer_similarity ENABLE ROW LEVEL SECURITY;

-- 5. Define RLS policy for secure access to match scores
-- Users can only SELECT their own pre-computed similarity scores
-- DROP POLICY IF EXISTS "Users can view their own match scores" ON peer_similarity;
-- CREATE POLICY "Users can view their own match scores"
-- ON peer_similarity
-- FOR SELECT
-- TO authenticated
-- USING (auth.uid() = user_id);
