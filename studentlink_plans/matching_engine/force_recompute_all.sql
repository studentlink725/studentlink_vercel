-- Forcefully recomputes matches for all users, bypassing the daily cooldown.
-- This script can be run multiple times for testing purposes.

SELECT recompute_scores_for_user(
    id, 
    0.6,    -- default major weight
    0.4,    -- default interests weight
    true    -- bypass_cooldown flag set to true
)
FROM students
WHERE matching_enabled = true;
