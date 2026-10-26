-- StudentLink Database Migration: Task 1.5 - pg_cron Schedule Setup
-- Run this script in the Supabase SQL Editor to schedule Jaccard score computation
-- to run in the background every 30 minutes for users whose 24-hour cooldown has elapsed.

-- 1. Enable the pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Schedule the match scores refresh job
-- Note: Supabase restricts pg_cron schema references to the default postgres database.
-- Standard syntax:
SELECT cron.schedule(
    'refresh-match-scores',
    '*/30 * * * *',
    $$ 
        SELECT recompute_scores_for_user(id)
        FROM students
        WHERE matching_enabled = true
          AND (last_match_refresh IS NULL
               OR last_match_refresh < NOW() - INTERVAL '24 hours');
    $$
);
