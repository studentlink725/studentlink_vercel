-- ============================================================
-- PERFORMANCE FIX: get_matching_peers
-- ============================================================
-- Problems with the old version:
--   1. Correlated subquery in SELECT (ran once per row for shared interests)
--   2. Multiple NOT IN (...UNION...) blocks - slow and breaks on NULLs
--   3. Two overloads of the same function causing confusion
--
-- Fixes applied:
--   1. Replaced correlated subquery with a pre-aggregated CTE (runs once total)
--   2. Replaced all NOT IN with LEFT JOIN ... WHERE IS NULL (sargable, NULL-safe, index-friendly)
--   3. Dropped both old overloads before recreating as a single clean version
-- ============================================================

-- Drop both overloads that may exist
DROP FUNCTION IF EXISTS get_matching_peers();
DROP FUNCTION IF EXISTS get_matching_peers(UUID);

CREATE OR REPLACE FUNCTION get_matching_peers(
    current_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    peer_id          UUID,
    peer_name        TEXT,
    peer_school      TEXT,
    peer_year        INT,
    peer_major       TEXT,
    shared_interests TEXT[],
    shared_courses   TEXT[],
    match_percentage NUMERIC
)
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID;
BEGIN
    -- Accept either the passed-in ID or fall back to the session user
    uid := COALESCE(current_user_id, auth.uid());

    IF uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    RETURN QUERY
    WITH
    -- Pre-compute this user's interest IDs once
    my_interests AS (
        SELECT interest_id FROM student_interests WHERE student_id = uid
    ),
    -- Pre-aggregate shared interests for all peers in one pass
    shared AS (
        SELECT
            si.student_id AS peer_id,
            ARRAY_AGG(i.interest ORDER BY i.interest) AS shared_interest_names
        FROM student_interests si
        JOIN interests i ON i.id = si.interest_id
        WHERE si.interest_id IN (SELECT interest_id FROM my_interests)
          AND si.student_id != uid
        GROUP BY si.student_id
    ),
    -- Collect all peer IDs to exclude (ignored, pending requests, friends)
    excluded AS (
        SELECT ip.peer_id   AS excluded_id FROM ignored_peers ip WHERE ip.user_id = uid
        UNION
        SELECT ip.user_id   AS excluded_id FROM ignored_peers ip WHERE ip.peer_id = uid
        UNION
        SELECT cr.recipient_id FROM connection_requests cr WHERE cr.requester_id = uid AND cr.status = 'pending'
        UNION
        SELECT cr.requester_id FROM connection_requests cr WHERE cr.recipient_id = uid AND cr.status = 'pending'
        UNION
        SELECT fc.user_high_id FROM friend_connections fc WHERE fc.user_low_id = uid
        UNION
        SELECT fc.user_low_id  FROM friend_connections fc WHERE fc.user_high_id = uid
    )
    SELECT
        ps.peer_id,
        s.name        AS peer_name,
        s.school      AS peer_school,
        s.year        AS peer_year,
        m.major       AS peer_major,
        COALESCE(sh.shared_interest_names, '{}'::TEXT[]) AS shared_interests,
        '{}'::TEXT[]  AS shared_courses,
        ps.match_score AS match_percentage
    FROM peer_similarity ps
    JOIN students s ON s.id = ps.peer_id
    LEFT JOIN majors m ON m.id = s.major_id
    LEFT JOIN shared sh ON sh.peer_id = ps.peer_id
    -- Exclude unwanted peers with a single LEFT JOIN (much faster than NOT IN)
    LEFT JOIN excluded ex ON ex.excluded_id = ps.peer_id
    WHERE ps.user_id = uid
      AND s.matching_enabled = true
      AND ps.match_score > 0
      AND ex.excluded_id IS NULL   -- keep only rows with NO match in excluded
    ORDER BY ps.match_score DESC;

END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION get_matching_peers(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_matching_peers(UUID) TO authenticated;
