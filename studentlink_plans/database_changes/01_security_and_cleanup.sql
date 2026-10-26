-- 1. Scrape Runs table structure and RLS fixes
-- Enable authenticated users to read scrape_runs if it's meant for a dashboard.
-- Also add completed_at to scrape_runs.
ALTER TABLE "public"."scrape_runs" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ;

-- Backfill completed_at for historical rows
UPDATE "public"."scrape_runs" SET completed_at = run_at WHERE status <> 'running' AND completed_at IS NULL;

-- Allow authenticated users to read scrape_runs (if desired for dashboard, assuming they need read access)
CREATE POLICY "scrape_runs_read_authenticated" 
ON "public"."scrape_runs" FOR SELECT 
TO "authenticated" 
USING (true);


-- 2. Protect last_match_refresh from being updated directly by users
-- We create a BEFORE UPDATE trigger that reverts last_match_refresh if the user is an authenticated client.
CREATE OR REPLACE FUNCTION public.protect_student_internal_fields()
RETURNS trigger AS $$
BEGIN
    IF auth.role() = 'authenticated' THEN
        NEW.last_match_refresh = OLD.last_match_refresh;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS ensure_student_internal_fields_protected ON public.students;
CREATE TRIGGER ensure_student_internal_fields_protected
BEFORE UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.protect_student_internal_fields();


-- 3. Fix recompute_scores_for_user to prevent bypassing cooldowns
-- We drop the function with arguments and recreate it without arguments.
DROP FUNCTION IF EXISTS "public"."recompute_scores_for_user"(numeric, numeric, boolean);

CREATE OR REPLACE FUNCTION "public"."recompute_scores_for_user"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    current_user_id     UUID := auth.uid();
    my_school          TEXT;
    my_major_id        UUID;
    my_interest_count  INT;
    last_refresh       TIMESTAMPTZ;
    has_major          BOOLEAN;
    has_interests      BOOLEAN;
    actual_w_major     NUMERIC;
    actual_w_interests NUMERIC;
    total_weight       NUMERIC;
    w_major            NUMERIC := 0.6;
    w_interests        NUMERIC := 0.4;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT school, major_id, last_match_refresh
    INTO my_school, my_major_id, last_refresh
    FROM students
    WHERE id = current_user_id;

    IF last_refresh IS NOT NULL
       AND last_refresh > '1970-01-01 00:00:00+00'::TIMESTAMPTZ
       AND last_refresh::date >= NOW()::date
    THEN
        RETURN;
    END IF;

    SELECT COUNT(*)
    INTO my_interest_count
    FROM student_interests
    WHERE student_id = current_user_id;

    has_major := (my_major_id IS NOT NULL);
    has_interests := (my_interest_count > 0);

    IF NOT has_major AND NOT has_interests THEN
        DELETE FROM peer_similarity WHERE user_id = current_user_id;
        UPDATE students SET last_match_refresh = NOW() WHERE id = current_user_id;
        RETURN;
    END IF;

    total_weight       := (CASE WHEN has_major THEN w_major ELSE 0 END) +
                          (CASE WHEN has_interests THEN w_interests ELSE 0 END);
    actual_w_major     := (CASE WHEN has_major THEN w_major ELSE 0 END) / total_weight;
    actual_w_interests := (CASE WHEN has_interests THEN w_interests ELSE 0 END) / total_weight;

    DELETE FROM peer_similarity WHERE user_id = current_user_id;

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
                    (CASE WHEN has_major AND s.major_id = my_major_id THEN actual_w_major ELSE 0 END)
                    +
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
          AND s.matching_enabled = true
          AND s.id NOT IN (
              SELECT peer_id FROM ignored_peers WHERE user_id = current_user_id
              UNION
              SELECT user_id FROM ignored_peers WHERE peer_id = current_user_id
          )
    ) computed_scores
    WHERE score > 0
    ORDER BY score DESC, peer_id
    LIMIT 3;

    UPDATE students
    SET last_match_refresh = NOW()
    WHERE id = current_user_id;
END;
$$;


-- 4. Fix ignore_peer to decline pending connection requests
CREATE OR REPLACE FUNCTION "public"."ignore_peer"("ignored_peer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    current_user_id UUID := auth.uid();
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- 1. Insert ignore record
    INSERT INTO ignored_peers (user_id, peer_id)
    VALUES (current_user_id, ignored_peer_id)
    ON CONFLICT DO NOTHING;

    -- 2. Clear matches immediately from the cache table
    DELETE FROM peer_similarity
    WHERE (user_id = current_user_id AND peer_id = ignored_peer_id)
       OR (user_id = ignored_peer_id AND peer_id = current_user_id);
       
    -- 3. Decline any pending connection requests between these two users
    UPDATE connection_requests
    SET status = 'declined',
        responded_at = NOW()
    WHERE status = 'pending'
      AND (
          (requester_id = current_user_id AND recipient_id = ignored_peer_id)
          OR
          (requester_id = ignored_peer_id AND recipient_id = current_user_id)
      );
END;
$$;
