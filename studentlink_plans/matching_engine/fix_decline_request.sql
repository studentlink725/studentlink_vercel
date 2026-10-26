CREATE OR REPLACE FUNCTION decline_connection_request(
    request_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
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
$$ LANGUAGE plpgsql;
