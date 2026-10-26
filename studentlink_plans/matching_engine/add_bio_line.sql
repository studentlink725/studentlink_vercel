-- 1. Add the bio_line column to the students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS bio_line TEXT;

-- 2. Update the get_friend_connections RPC to return the new bio_line column
DROP FUNCTION IF EXISTS get_friend_connections();

CREATE OR REPLACE FUNCTION get_friend_connections()
RETURNS TABLE (
    friend_id      UUID,
    friend_name    TEXT,
    friend_major   TEXT,
    friend_year    INT,
    created_at     TIMESTAMPTZ,
    bio_line       TEXT
)
SECURITY DEFINER
SET search_path = public
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
        s.bio_line
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
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_friend_connections() TO authenticated;
