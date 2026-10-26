


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."accept_connection_request"("request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    current_user_id UUID := auth.uid();
    request_row RECORD;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    SELECT *
    INTO request_row
    FROM connection_requests
    WHERE id = request_id
      AND recipient_id = current_user_id
      AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Connection request not found.';
    END IF;

    UPDATE connection_requests
    SET status = 'accepted',
        responded_at = NOW()
    WHERE id = request_row.id;

    INSERT INTO friend_connections (
        user_low_id,
        user_high_id,
        created_by
    )
    VALUES (
        LEAST(current_user_id, request_row.requester_id),
        GREATEST(current_user_id, request_row.requester_id),
        current_user_id
    )
    ON CONFLICT (user_low_id, user_high_id) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."accept_connection_request"("request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_major_if_not_exists"("p_school" "text", "p_major" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    cleaned_school TEXT;
    cleaned_major TEXT;
    result_id UUID;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    cleaned_school := BTRIM(p_school);
    cleaned_major  := BTRIM(p_major);

    IF cleaned_school = '' OR cleaned_major = '' THEN
        RAISE EXCEPTION 'School and major must not be empty.';
    END IF;

    IF char_length(cleaned_major) > 100 THEN
        RAISE EXCEPTION 'Major name too long.';
    END IF;

    -- Case-insensitive existing match first
    SELECT id INTO result_id
    FROM majors
    WHERE lower(school) = lower(cleaned_school)
      AND lower(major) = lower(cleaned_major)
    LIMIT 1;

    IF result_id IS NOT NULL THEN
        RETURN result_id;
    END IF;

    INSERT INTO majors (school, major)
    VALUES (cleaned_school, cleaned_major)
    ON CONFLICT (school, major) DO NOTHING
    RETURNING id INTO result_id;

    -- ON CONFLICT DO NOTHING with no match returns null; re-select if a
    -- concurrent insert won the race
    IF result_id IS NULL THEN
        SELECT id INTO result_id
        FROM majors
        WHERE lower(school) = lower(cleaned_school)
          AND lower(major) = lower(cleaned_major)
        LIMIT 1;
    END IF;

    RETURN result_id;
END;
$$;


ALTER FUNCTION "public"."add_major_if_not_exists"("p_school" "text", "p_major" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decline_connection_request"("request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    current_user_id UUID := auth.uid();
    request_row RECORD;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- Fetch the request to get the requester_id
    SELECT *
    INTO request_row
    FROM connection_requests
    WHERE id = request_id
      AND recipient_id = current_user_id
      AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Connection request not found or not pending.';
    END IF;

    -- Update status to declined
    UPDATE connection_requests
    SET status = 'declined',
        responded_at = NOW()
    WHERE id = request_row.id;

    -- Add to ignored peers to ensure they don't show up in Matches again
    INSERT INTO ignored_peers (user_id, peer_id)
    VALUES (current_user_id, request_row.requester_id)
    ON CONFLICT DO NOTHING;

    -- Remove from cached peer_similarity table immediately
    DELETE FROM peer_similarity
    WHERE (user_id = current_user_id AND peer_id = request_row.requester_id)
       OR (user_id = request_row.requester_id AND peer_id = current_user_id);
END;
$$;


ALTER FUNCTION "public"."decline_connection_request"("request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_friend_connections"() RETURNS TABLE("friend_id" "uuid", "friend_name" "text", "friend_major" "text", "friend_year" integer, "created_at" timestamp with time zone, "bio_line" "text", "avatar_url" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    RETURN QUERY
    SELECT
        CASE
            WHEN fc.user_low_id = auth.uid() THEN fc.user_high_id
            ELSE fc.user_low_id
        END AS friend_id,
        s.name AS friend_name,
        m.major AS friend_major,
        s.year AS friend_year,
        fc.created_at,
        CASE WHEN s.share_bio THEN s.bio_line ELSE NULL END AS bio_line,
        s.avatar_url
    FROM friend_connections fc
    JOIN students s
      ON s.id = CASE
                  WHEN fc.user_low_id = auth.uid() THEN fc.user_high_id
                  ELSE fc.user_low_id
                END
    LEFT JOIN majors m ON m.id = s.major_id
    WHERE fc.user_low_id = auth.uid()
       OR fc.user_high_id = auth.uid()
    ORDER BY fc.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_friend_connections"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_incoming_connection_requests"("page_size" integer DEFAULT 50, "page_offset" integer DEFAULT 0) RETURNS TABLE("request_id" "uuid", "requester_id" "uuid", "requester_name" "text", "requester_major" "text", "requester_year" integer, "request_message" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    RETURN QUERY
    SELECT
        cr.id AS request_id,
        cr.requester_id,
        s.name AS requester_name,
        m.major AS requester_major,
        s.year AS requester_year,
        cr.request_message,
        cr.created_at
    FROM connection_requests cr
    JOIN students s ON s.id = cr.requester_id
    LEFT JOIN majors m ON m.id = s.major_id
    WHERE cr.recipient_id = auth.uid()
      AND cr.status = 'pending'
    ORDER BY cr.created_at DESC
    LIMIT GREATEST(LEAST(page_size, 100), 1)
    OFFSET GREATEST(page_offset, 0);
END;
$$;


ALTER FUNCTION "public"."get_incoming_connection_requests"("page_size" integer, "page_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_matching_peers"() RETURNS TABLE("peer_id" "uuid", "peer_name" "text", "peer_school" "text", "peer_year" integer, "peer_major" "text", "shared_interests" "text"[], "shared_courses" "text"[], "match_percentage" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    uid UUID := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    RETURN QUERY
    WITH
    my_interests AS (
        SELECT interest_id FROM student_interests WHERE student_id = uid
    ),
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
    LEFT JOIN excluded ex ON ex.excluded_id = ps.peer_id
    WHERE ps.user_id = uid
      AND s.matching_enabled = true
      AND ps.match_score > 0
      AND ex.excluded_id IS NULL
    ORDER BY ps.match_score DESC;

END;
$$;


ALTER FUNCTION "public"."get_matching_peers"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_outgoing_connection_requests"("page_size" integer DEFAULT 50, "page_offset" integer DEFAULT 0) RETURNS TABLE("request_id" "uuid", "recipient_id" "uuid", "recipient_name" "text", "recipient_major" "text", "recipient_year" integer, "request_message" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    RETURN QUERY
    SELECT
        cr.id AS request_id,
        cr.recipient_id,
        s.name AS recipient_name,
        m.major AS recipient_major,
        s.year AS recipient_year,
        cr.request_message,
        cr.created_at
    FROM connection_requests cr
    JOIN students s ON s.id = cr.recipient_id
    LEFT JOIN majors m ON m.id = s.major_id
    WHERE cr.requester_id = auth.uid()
      AND cr.status = 'pending'
    ORDER BY cr.created_at DESC
    LIMIT GREATEST(LEAST(page_size, 100), 1)
    OFFSET GREATEST(page_offset, 0);
END;
$$;


ALTER FUNCTION "public"."get_outgoing_connection_requests"("page_size" integer, "page_offset" integer) OWNER TO "postgres";


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
END;
$$;


ALTER FUNCTION "public"."ignore_peer"("ignored_peer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."queue_new_user_for_matching"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.last_match_refresh := '1970-01-01 00:00:00+00'::TIMESTAMPTZ;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."queue_new_user_for_matching"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_scores_for_user"("w_major" numeric DEFAULT 0.6, "w_interests" numeric DEFAULT 0.4, "bypass_cooldown" boolean DEFAULT false) RETURNS "void"
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
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    -- 1. Gather current student context and refresh timestamp
    SELECT school, major_id, last_match_refresh
    INTO my_school, my_major_id, last_refresh
    FROM students
    WHERE id = current_user_id;

    IF NOT bypass_cooldown
       AND last_refresh IS NOT NULL
       AND last_refresh > '1970-01-01 00:00:00+00'::TIMESTAMPTZ
       AND last_refresh::date >= NOW()::date
    THEN
        RETURN;
    END IF;

    -- 2. Count current student's interests
    SELECT COUNT(*)
    INTO my_interest_count
    FROM student_interests
    WHERE student_id = current_user_id;

    has_major := (my_major_id IS NOT NULL);
    has_interests := (my_interest_count > 0);

    -- 3. If the user has neither major nor interests, we cannot match them.
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

    -- 7. Update last refresh timestamp to enforce the calendar daily cooldown
    UPDATE students
    SET last_match_refresh = NOW()
    WHERE id = current_user_id;
END;
$$;


ALTER FUNCTION "public"."recompute_scores_for_user"("w_major" numeric, "w_interests" numeric, "bypass_cooldown" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."remove_friend_connection"("target_peer_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    current_user_id UUID := auth.uid();
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    DELETE FROM friend_connections
    WHERE user_low_id = LEAST(current_user_id, target_peer_id)
      AND user_high_id = GREATEST(current_user_id, target_peer_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No connection found with this student.';
    END IF;
END;
$$;


ALTER FUNCTION "public"."remove_friend_connection"("target_peer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_connection_request"("target_peer_id" "uuid", "request_message" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    current_user_id UUID := auth.uid();
    cleaned_message TEXT;
    reciprocal_request_id UUID;
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    cleaned_message := NULLIF(BTRIM(request_message), '');

    IF cleaned_message IS NOT NULL AND char_length(cleaned_message) > 128 THEN
        RAISE EXCEPTION 'Connection request message must be 128 characters or fewer.';
    END IF;

    IF current_user_id = target_peer_id THEN
        RAISE EXCEPTION 'You cannot send a connection request to yourself.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM friend_connections
        WHERE user_low_id = LEAST(current_user_id, target_peer_id)
          AND user_high_id = GREATEST(current_user_id, target_peer_id)
    ) THEN
        RAISE EXCEPTION 'You are already connected with this student.';
    END IF;

    SELECT id
    INTO reciprocal_request_id
    FROM connection_requests
    WHERE requester_id = target_peer_id
      AND recipient_id = current_user_id
      AND status = 'pending'
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF reciprocal_request_id IS NOT NULL THEN
        UPDATE connection_requests
        SET status = 'accepted',
            responded_at = NOW()
        WHERE id = reciprocal_request_id;

        INSERT INTO friend_connections (
            user_low_id,
            user_high_id,
            created_by
        )
        VALUES (
            LEAST(current_user_id, target_peer_id),
            GREATEST(current_user_id, target_peer_id),
            current_user_id
        )
        ON CONFLICT (user_low_id, user_high_id) DO NOTHING;
        RETURN;
    END IF;

    INSERT INTO connection_requests (
        requester_id,
        recipient_id,
        request_message,
        status
    )
    VALUES (
        current_user_id,
        target_peer_id,
        cleaned_message,
        'pending'
    )
    ON CONFLICT (requester_id, recipient_id)
    WHERE status = 'pending'
    DO UPDATE SET
        request_message = EXCLUDED.request_message,
        created_at = NOW(),
        responded_at = NULL;
END;
$$;


ALTER FUNCTION "public"."send_connection_request"("target_peer_id" "uuid", "request_message" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."withdraw_connection_request"("request_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    current_user_id UUID := auth.uid();
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    UPDATE connection_requests
    SET status = 'withdrawn',
        responded_at = NOW()
    WHERE id = request_id
      AND requester_id = current_user_id
      AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Connection request not found or not pending.';
    END IF;
END;
$$;


ALTER FUNCTION "public"."withdraw_connection_request"("request_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."connection_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "recipient_id" "uuid" NOT NULL,
    "request_message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    CONSTRAINT "connection_requests_message_length" CHECK ((("request_message" IS NULL) OR ("char_length"("request_message") <= 128))),
    CONSTRAINT "connection_requests_no_self_request" CHECK (("requester_id" <> "recipient_id")),
    CONSTRAINT "connection_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'withdrawn'::"text"])))
);


ALTER TABLE "public"."connection_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school" "text" NOT NULL,
    "course" "text" NOT NULL
);


ALTER TABLE "public"."courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."event_rsvps" (
    "event_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."event_rsvps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source" "text" NOT NULL,
    "external_id" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "url" "text",
    "image_url" "text",
    "start_time" timestamp with time zone,
    "end_time" timestamp with time zone,
    "location" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "tagged_by" "text",
    "raw" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scrape_run_id" "uuid",
    "city" "text",
    "province_state" "text",
    "country" "text"
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friend_connections" (
    "user_low_id" "uuid" NOT NULL,
    "user_high_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    CONSTRAINT "friend_connections_no_self_connection" CHECK (("user_low_id" <> "user_high_id"))
);


ALTER TABLE "public"."friend_connections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ignored_peers" (
    "user_id" "uuid" NOT NULL,
    "peer_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ignored_peers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "interest" "text" NOT NULL
);


ALTER TABLE "public"."interests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."majors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school" "text" NOT NULL,
    "major" "text" NOT NULL
);


ALTER TABLE "public"."majors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."peer_similarity" (
    "user_id" "uuid" NOT NULL,
    "peer_id" "uuid" NOT NULL,
    "match_score" numeric,
    "computed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."peer_similarity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scrape_runs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "source" "text" NOT NULL,
    "status" "text" NOT NULL,
    "items_found" integer,
    "error" "text",
    "ai_enrichment_status" "text",
    "run_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "scrape_runs_ai_enrichment_status_check" CHECK (("ai_enrichment_status" = ANY (ARRAY['success'::"text", 'fallback'::"text", 'skipped'::"text"]))),
    CONSTRAINT "scrape_runs_status_check" CHECK (("status" = ANY (ARRAY['running'::"text", 'success'::"text", 'partial'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."scrape_runs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_courses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "course_id" "uuid"
);


ALTER TABLE "public"."student_courses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_interests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "interest_id" "uuid"
);


ALTER TABLE "public"."student_interests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" NOT NULL,
    "name" "text",
    "school" "text" NOT NULL,
    "major_id" "uuid",
    "email" "text",
    "year" integer,
    "matching_enabled" boolean DEFAULT true,
    "last_match_refresh" timestamp with time zone,
    "bio_line" "text",
    "share_bio" boolean DEFAULT true,
    "avatar_url" "text",
    CONSTRAINT "students_year_check" CHECK ((("year" >= 1) AND ("year" <= 5)))
);


ALTER TABLE "public"."students" OWNER TO "postgres";


ALTER TABLE ONLY "public"."connection_requests"
    ADD CONSTRAINT "connection_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courses"
    ADD CONSTRAINT "courses_school_course_key" UNIQUE ("school", "course");



ALTER TABLE ONLY "public"."event_rsvps"
    ADD CONSTRAINT "event_rsvps_pkey" PRIMARY KEY ("event_id", "student_id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_external_id_unique" UNIQUE ("external_id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friend_connections"
    ADD CONSTRAINT "friend_connections_pkey" PRIMARY KEY ("user_low_id", "user_high_id");



ALTER TABLE ONLY "public"."ignored_peers"
    ADD CONSTRAINT "ignored_peers_pkey" PRIMARY KEY ("user_id", "peer_id");



ALTER TABLE ONLY "public"."interests"
    ADD CONSTRAINT "interests_interest_key" UNIQUE ("interest");



ALTER TABLE ONLY "public"."interests"
    ADD CONSTRAINT "interests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."majors"
    ADD CONSTRAINT "majors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."majors"
    ADD CONSTRAINT "majors_school_major_key" UNIQUE ("school", "major");



ALTER TABLE ONLY "public"."peer_similarity"
    ADD CONSTRAINT "peer_similarity_pkey" PRIMARY KEY ("user_id", "peer_id");



ALTER TABLE ONLY "public"."scrape_runs"
    ADD CONSTRAINT "scrape_runs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_courses"
    ADD CONSTRAINT "student_courses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_courses"
    ADD CONSTRAINT "student_courses_student_id_course_id_key" UNIQUE ("student_id", "course_id");



ALTER TABLE ONLY "public"."student_interests"
    ADD CONSTRAINT "student_interests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_interests"
    ADD CONSTRAINT "student_interests_student_id_interest_id_key" UNIQUE ("student_id", "interest_id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



CREATE INDEX "events_scrape_run_id_idx" ON "public"."events" USING "btree" ("scrape_run_id");



CREATE INDEX "events_source_idx" ON "public"."events" USING "btree" ("source");



CREATE INDEX "events_start_time_idx" ON "public"."events" USING "btree" ("start_time");



CREATE INDEX "events_tags_gin_idx" ON "public"."events" USING "gin" ("tags");



CREATE INDEX "idx_connection_requests_recipient_status_created_at" ON "public"."connection_requests" USING "btree" ("recipient_id", "status", "created_at" DESC);



CREATE INDEX "idx_connection_requests_requester_status_created_at" ON "public"."connection_requests" USING "btree" ("requester_id", "status", "created_at" DESC);



CREATE UNIQUE INDEX "idx_connection_requests_unique_pending_pair" ON "public"."connection_requests" USING "btree" ("requester_id", "recipient_id") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_event_rsvps_student" ON "public"."event_rsvps" USING "btree" ("student_id");



CREATE INDEX "idx_friend_connections_user_high" ON "public"."friend_connections" USING "btree" ("user_high_id", "created_at" DESC);



CREATE INDEX "idx_friend_connections_user_low" ON "public"."friend_connections" USING "btree" ("user_low_id", "created_at" DESC);



CREATE INDEX "idx_ignored_peers_lookup" ON "public"."ignored_peers" USING "btree" ("user_id", "peer_id");



CREATE INDEX "idx_peer_similarity_lookup" ON "public"."peer_similarity" USING "btree" ("user_id", "match_score" DESC);



CREATE INDEX "idx_student_interests_interest" ON "public"."student_interests" USING "btree" ("interest_id");



CREATE INDEX "idx_student_interests_student" ON "public"."student_interests" USING "btree" ("student_id");



CREATE INDEX "scrape_runs_run_at_idx" ON "public"."scrape_runs" USING "btree" ("run_at" DESC);



CREATE INDEX "scrape_runs_source_idx" ON "public"."scrape_runs" USING "btree" ("source");



CREATE INDEX "scrape_runs_status_idx" ON "public"."scrape_runs" USING "btree" ("status");



CREATE OR REPLACE TRIGGER "events_set_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "on_new_student" BEFORE INSERT ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."queue_new_user_for_matching"();



ALTER TABLE ONLY "public"."connection_requests"
    ADD CONSTRAINT "connection_requests_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."connection_requests"
    ADD CONSTRAINT "connection_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_rsvps"
    ADD CONSTRAINT "event_rsvps_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_rsvps"
    ADD CONSTRAINT "event_rsvps_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_scrape_run_id_fkey" FOREIGN KEY ("scrape_run_id") REFERENCES "public"."scrape_runs"("id");



ALTER TABLE ONLY "public"."friend_connections"
    ADD CONSTRAINT "friend_connections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_connections"
    ADD CONSTRAINT "friend_connections_user_high_id_fkey" FOREIGN KEY ("user_high_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_connections"
    ADD CONSTRAINT "friend_connections_user_low_id_fkey" FOREIGN KEY ("user_low_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ignored_peers"
    ADD CONSTRAINT "ignored_peers_peer_id_fkey" FOREIGN KEY ("peer_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ignored_peers"
    ADD CONSTRAINT "ignored_peers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."peer_similarity"
    ADD CONSTRAINT "peer_similarity_peer_id_fkey" FOREIGN KEY ("peer_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."peer_similarity"
    ADD CONSTRAINT "peer_similarity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_courses"
    ADD CONSTRAINT "student_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id");



ALTER TABLE ONLY "public"."student_courses"
    ADD CONSTRAINT "student_courses_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."student_interests"
    ADD CONSTRAINT "student_interests_interest_id_fkey" FOREIGN KEY ("interest_id") REFERENCES "public"."interests"("id");



ALTER TABLE ONLY "public"."student_interests"
    ADD CONSTRAINT "student_interests_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_major_id_fkey" FOREIGN KEY ("major_id") REFERENCES "public"."majors"("id");



CREATE POLICY "Anyone can view RSVPs" ON "public"."event_rsvps" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can add courses" ON "public"."courses" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can read courses" ON "public"."courses" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read events" ON "public"."events" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read interests" ON "public"."interests" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read majors" ON "public"."majors" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can create their own RSVPs" ON "public"."event_rsvps" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "student_id"));



CREATE POLICY "Users can create their own profile" ON "public"."students" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can delete their own RSVPs" ON "public"."event_rsvps" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Users can read their own profile" ON "public"."students" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own profile" ON "public"."students" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users manage their own courses" ON "public"."student_courses" TO "authenticated" USING (("auth"."uid"() = "student_id")) WITH CHECK (("auth"."uid"() = "student_id"));



CREATE POLICY "Users manage their own interests" ON "public"."student_interests" TO "authenticated" USING (("auth"."uid"() = "student_id")) WITH CHECK (("auth"."uid"() = "student_id"));



ALTER TABLE "public"."connection_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_rsvps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friend_connections" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ignored_peers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."majors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."peer_similarity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scrape_runs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_courses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_interests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_connection_request"("request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_connection_request"("request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."accept_connection_request"("request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_connection_request"("request_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."add_major_if_not_exists"("p_school" "text", "p_major" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_major_if_not_exists"("p_school" "text", "p_major" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_major_if_not_exists"("p_school" "text", "p_major" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_major_if_not_exists"("p_school" "text", "p_major" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."decline_connection_request"("request_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."decline_connection_request"("request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."decline_connection_request"("request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."decline_connection_request"("request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_friend_connections"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_friend_connections"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_friend_connections"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_incoming_connection_requests"("page_size" integer, "page_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_incoming_connection_requests"("page_size" integer, "page_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_incoming_connection_requests"("page_size" integer, "page_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_incoming_connection_requests"("page_size" integer, "page_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_matching_peers"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_matching_peers"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_matching_peers"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_matching_peers"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_outgoing_connection_requests"("page_size" integer, "page_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_outgoing_connection_requests"("page_size" integer, "page_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_outgoing_connection_requests"("page_size" integer, "page_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."ignore_peer"("ignored_peer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ignore_peer"("ignored_peer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ignore_peer"("ignored_peer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ignore_peer"("ignored_peer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_new_user_for_matching"() TO "anon";
GRANT ALL ON FUNCTION "public"."queue_new_user_for_matching"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_new_user_for_matching"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."recompute_scores_for_user"("w_major" numeric, "w_interests" numeric, "bypass_cooldown" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."recompute_scores_for_user"("w_major" numeric, "w_interests" numeric, "bypass_cooldown" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."recompute_scores_for_user"("w_major" numeric, "w_interests" numeric, "bypass_cooldown" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."recompute_scores_for_user"("w_major" numeric, "w_interests" numeric, "bypass_cooldown" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."remove_friend_connection"("target_peer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."remove_friend_connection"("target_peer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_friend_connection"("target_peer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_friend_connection"("target_peer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."send_connection_request"("target_peer_id" "uuid", "request_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."send_connection_request"("target_peer_id" "uuid", "request_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."send_connection_request"("target_peer_id" "uuid", "request_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_connection_request"("target_peer_id" "uuid", "request_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."withdraw_connection_request"("request_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."withdraw_connection_request"("request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."withdraw_connection_request"("request_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."connection_requests" TO "service_role";



GRANT ALL ON TABLE "public"."courses" TO "service_role";
GRANT SELECT,INSERT ON TABLE "public"."courses" TO "authenticated";



GRANT ALL ON TABLE "public"."event_rsvps" TO "service_role";
GRANT SELECT,INSERT,DELETE ON TABLE "public"."event_rsvps" TO "authenticated";



GRANT ALL ON TABLE "public"."events" TO "service_role";
GRANT SELECT ON TABLE "public"."events" TO "authenticated";



GRANT ALL ON TABLE "public"."friend_connections" TO "service_role";



GRANT ALL ON TABLE "public"."ignored_peers" TO "service_role";



GRANT ALL ON TABLE "public"."interests" TO "service_role";
GRANT SELECT ON TABLE "public"."interests" TO "authenticated";



GRANT ALL ON TABLE "public"."majors" TO "service_role";
GRANT SELECT ON TABLE "public"."majors" TO "authenticated";



GRANT ALL ON TABLE "public"."peer_similarity" TO "service_role";



GRANT ALL ON TABLE "public"."scrape_runs" TO "service_role";



GRANT ALL ON TABLE "public"."student_courses" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."student_courses" TO "authenticated";



GRANT ALL ON TABLE "public"."student_interests" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."student_interests" TO "authenticated";



GRANT ALL ON TABLE "public"."students" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "public"."students" TO "authenticated";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







