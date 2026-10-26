CREATE OR REPLACE FUNCTION get_matching_peers()
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
    current_user_id UUID := auth.uid();
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    RETURN QUERY
    SELECT
        ps.peer_id,
        s.name AS peer_name,
        s.school AS peer_school,
        s.year AS peer_year,
        m.major AS peer_major,
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
        '{}'::TEXT[] AS shared_courses,
        ps.match_score AS match_percentage
    FROM peer_similarity ps
    JOIN students s ON s.id = ps.peer_id
    LEFT JOIN majors m ON m.id = s.major_id
    WHERE ps.user_id = current_user_id
      AND s.matching_enabled = true
      AND ps.match_score > 0
      AND ps.peer_id NOT IN (
          SELECT ip.peer_id FROM ignored_peers ip WHERE ip.user_id = current_user_id
          UNION
          SELECT ip.user_id FROM ignored_peers ip WHERE ip.peer_id = current_user_id
      )
      AND ps.peer_id NOT IN (
          SELECT recipient_id FROM connection_requests WHERE requester_id = current_user_id AND status = 'pending'
          UNION
          SELECT requester_id FROM connection_requests WHERE recipient_id = current_user_id AND status = 'pending'
          UNION
          SELECT user_high_id FROM friend_connections WHERE user_low_id = current_user_id
          UNION
          SELECT user_low_id FROM friend_connections WHERE user_high_id = current_user_id
      )
    ORDER BY ps.match_score DESC;
END;
$$ LANGUAGE plpgsql;

REVOKE EXECUTE ON FUNCTION get_matching_peers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_matching_peers() TO authenticated;
