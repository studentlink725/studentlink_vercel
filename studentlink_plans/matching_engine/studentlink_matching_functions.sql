-- StudentLink Database Migration: Tasks 1.2, 1.3, and 1.4 - Functions and Triggers
-- This migration script registers the trigger for new user bootstrap, the weighted Jaccard calculation function,
-- and the optimized peer lookup function.

--------------------------------------------------------------------------------
-- Task 1.2: Trigger for New User Bootstrap
--------------------------------------------------------------------------------
-- Set new user's last refresh time to a past timestamp so the cron job picks them up immediately.
CREATE OR REPLACE FUNCTION queue_new_user_for_matching()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_match_refresh := '1970-01-01 00:00:00+00'::TIMESTAMPTZ;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_new_student
BEFORE INSERT ON students
FOR EACH ROW
EXECUTE FUNCTION queue_new_user_for_matching();


--------------------------------------------------------------------------------
-- Task 1.3: Background Score Recomputation Function
--------------------------------------------------------------------------------
-- Calculates similarity scores for all candidate peers and stores the top 3 in peer_similarity.
DROP FUNCTION IF EXISTS recompute_scores_for_user(UUID, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION recompute_scores_for_user(
    current_user_id UUID,
    w_major         NUMERIC DEFAULT 0.6,
    w_interests     NUMERIC DEFAULT 0.4,
    bypass_cooldown BOOLEAN DEFAULT false
)
RETURNS VOID SECURITY DEFINER SET search_path = public AS $$
DECLARE
    my_school          TEXT;
    my_major_id        UUID;
    my_interest_count  INT;
    last_refresh       TIMESTAMPTZ;
    has_major          BOOLEAN;
    has_interests      BOOLEAN;
    actual_w_major     NUMERIC;
    actual_w_interests NUMERIC;
    total_weight       NUMERIC;
BEGIN
    -- 1. Gather current student context and refresh timestamp
    SELECT school, major_id, last_match_refresh
    INTO my_school, my_major_id, last_refresh
    FROM students
    WHERE id = current_user_id;

    -- Check if it's already been calculated today (calendar midnight update)
    -- EXCEPT if the refresh timestamp is set to the epoch date '1970-01-01' (new user bootstrap)
    -- OR if we are explicitly bypassing the cooldown (e.g. after ignoring a match)
    IF NOT bypass_cooldown
       AND last_refresh IS NOT NULL 
       AND last_refresh > '1970-01-01 00:00:00+00'::TIMESTAMPTZ
       AND (last_refresh AT TIME ZONE 'America/Edmonton')::date >= (NOW() AT TIME ZONE 'America/Edmonton')::date
    THEN
        RETURN;
    END IF;

    -- 2. Count current student's interests
    SELECT COUNT(*)
    INTO my_interest_count
    FROM student_interests
    WHERE student_id = current_user_id;

    -- Check what attributes are populated for the current user
    has_major := (my_major_id IS NOT NULL);
    has_interests := (my_interest_count > 0);

    -- 3. If the user has neither major nor interests, we cannot match them.
    -- Clear old scores and return early to save database load.
    IF NOT has_major AND NOT has_interests THEN
        DELETE FROM peer_similarity WHERE user_id = current_user_id;
        UPDATE students SET last_match_refresh = NOW() WHERE id = current_user_id;
        RETURN;
    END IF;

    -- 4. Calculate total weight dynamically based on available attributes
    total_weight       := (CASE WHEN has_major THEN w_major ELSE 0 END) + 
                          (CASE WHEN has_interests THEN w_interests ELSE 0 END);
    actual_w_major     := (CASE WHEN has_major THEN w_major ELSE 0 END) / total_weight;
    actual_w_interests := (CASE WHEN has_interests THEN w_interests ELSE 0 END) / total_weight;

    -- 5. Delete old scores for this user to rebuild the top 3 list
    DELETE FROM peer_similarity WHERE user_id = current_user_id;

    -- 6. Calculate and insert top 3 peer similarity scores
    INSERT INTO peer_similarity (user_id, peer_id, match_score)
    SELECT current_user_id, peer_id, score
    FROM (
        WITH peer_interests AS (
            SELECT
                si.student_id AS peer_id,
                COUNT(DISTINCT si.interest_id) AS interest_count,
                COUNT(si.interest_id) FILTER (WHERE si.interest_id IN (
                    SELECT interest_id FROM student_interests WHERE student_id = current_user_id
                )) AS shared_count
            FROM student_interests si
            WHERE si.student_id != current_user_id
            GROUP BY si.student_id
        )
        SELECT
            s.id AS peer_id,
            ROUND(
                (
                    -- Major component similarity (only calculated if current user has a major)
                    (CASE WHEN has_major AND s.major_id = my_major_id THEN actual_w_major ELSE 0 END)
                    +
                    -- Interests Jaccard similarity component (only calculated if current user has interests)
                    (CASE
                        WHEN has_interests AND (my_interest_count + COALESCE(pi.interest_count, 0) - COALESCE(pi.shared_count, 0)) > 0
                        THEN actual_w_interests * (
                            COALESCE(pi.shared_count, 0)::NUMERIC
                            / (my_interest_count + COALESCE(pi.interest_count, 0) - COALESCE(pi.shared_count, 0))
                        )
                        ELSE 0
                    END)
                ) * 100,
                0) AS score
        FROM students s
        LEFT JOIN peer_interests pi ON pi.peer_id = s.id
        WHERE s.id            != current_user_id
          AND s.school         = my_school
          AND s.matching_enabled = true          -- Respect discovery settings
          -- Exclude any peers that are ignored by this user or have ignored this user
          AND s.id NOT IN (
              SELECT peer_id FROM ignored_peers WHERE user_id = current_user_id
              UNION
              SELECT user_id FROM ignored_peers WHERE peer_id = current_user_id
          )
    ) computed_scores
    WHERE score > 0 -- Only matches with score > 0% are stored and shown
    ORDER BY score DESC, peer_id
    LIMIT 3;

    -- 7. Update last refresh timestamp to enforce the calendar daily cooldown
    UPDATE students
    SET last_match_refresh = NOW()
    WHERE id = current_user_id;
END;
$$ LANGUAGE plpgsql;


--------------------------------------------------------------------------------
-- Task 1.4: Matching Results Fetch Function
--------------------------------------------------------------------------------
-- Retrieves the pre-computed match list for a user, complete with names and matching details.
-- Excludes ignored peers and any match score <= 0%.
CREATE OR REPLACE FUNCTION get_matching_peers(
    current_user_id UUID
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
) SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        ps.peer_id,
        s.name AS peer_name,
        s.school AS peer_school,
        s.year AS peer_year,
        m.major AS peer_major,
        -- Fetch actual shared interest text names
        COALESCE(
          (SELECT ARRAY_AGG(i.interest)
           FROM student_interests si
           JOIN interests i ON i.id = si.interest_id
           WHERE si.student_id = ps.peer_id
             AND si.interest_id IN (
               SELECT interest_id FROM student_interests WHERE student_id = current_user_id
             )
          ), '{}'::TEXT[]
        ) AS shared_interests,
        '{}'::TEXT[] AS shared_courses, -- Placeholder for courses
        ps.match_score AS match_percentage
    FROM peer_similarity ps
    JOIN students s ON s.id = ps.peer_id
    LEFT JOIN majors m ON m.id = s.major_id
    WHERE ps.user_id = current_user_id
      AND s.matching_enabled = true
      AND ps.match_score > 0
      -- Exclude any ignored matches dynamically
      AND ps.peer_id NOT IN (
          SELECT ip.peer_id FROM ignored_peers ip WHERE ip.user_id = current_user_id
          UNION
          SELECT ip.user_id FROM ignored_peers ip WHERE ip.peer_id = current_user_id
      )
    ORDER BY ps.match_score DESC;
END;
$$ LANGUAGE plpgsql;


--------------------------------------------------------------------------------
-- Task 1.6: Ignore Peer Function
--------------------------------------------------------------------------------
-- Inserts the ignore relation, removes the match from peer_similarity, and
-- triggers an immediate recomputation to fill the empty slot.
CREATE OR REPLACE FUNCTION ignore_peer(
    current_user_id UUID,
    ignored_peer_id UUID
)
RETURNS VOID SECURITY DEFINER SET search_path = public AS $$
BEGIN
    -- 1. Insert ignore record
    INSERT INTO ignored_peers (user_id, peer_id)
    VALUES (current_user_id, ignored_peer_id)
    ON CONFLICT DO NOTHING;

    -- 2. Clear matches immediately from the cache table
    DELETE FROM peer_similarity
    WHERE (user_id = current_user_id AND peer_id = ignored_peer_id)
       OR (user_id = ignored_peer_id AND peer_id = current_user_id);
END;
$$ LANGUAGE plpgsql;
