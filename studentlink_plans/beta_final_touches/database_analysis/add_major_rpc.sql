CREATE OR REPLACE FUNCTION "public"."add_major_if_not_exists"(
    "p_school" "text",
    "p_major" "text"
) RETURNS "uuid"
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

REVOKE ALL ON FUNCTION "public"."add_major_if_not_exists"("p_school" "text", "p_major" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_major_if_not_exists"("p_school" "text", "p_major" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_major_if_not_exists"("p_school" "text", "p_major" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_major_if_not_exists"("p_school" "text", "p_major" "text") TO "service_role";
