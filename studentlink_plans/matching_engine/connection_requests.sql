-- StudentLink Connection Requests Migration
-- Secure request storage and RPCs for incoming requests, message sending, accept, and decline.

--------------------------------------------------------------------------------
-- 1. Connection Request Storage
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connection_requests (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    recipient_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    request_message TEXT,
    status         TEXT NOT NULL DEFAULT 'pending',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at   TIMESTAMPTZ
);

ALTER TABLE connection_requests
    ADD CONSTRAINT connection_requests_message_length
    CHECK (request_message IS NULL OR char_length(request_message) <= 128);

ALTER TABLE connection_requests
    ADD CONSTRAINT connection_requests_status_check
    CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn'));

ALTER TABLE connection_requests
    ADD CONSTRAINT connection_requests_no_self_request
    CHECK (requester_id <> recipient_id);

CREATE INDEX IF NOT EXISTS idx_connection_requests_recipient_status_created_at
    ON connection_requests(recipient_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_connection_requests_requester_status_created_at
    ON connection_requests(requester_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connection_requests_unique_pending_pair
    ON connection_requests(requester_id, recipient_id)
    WHERE status = 'pending';

ALTER TABLE connection_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Requesters can insert their own connection requests" ON connection_requests;
CREATE POLICY "Requesters can insert their own pending connection requests"
ON connection_requests
FOR INSERT
TO authenticated
WITH CHECK (
    requester_id = auth.uid()
    AND status = 'pending'
    AND responded_at IS NULL
);

DROP POLICY IF EXISTS "Users can view their own connection requests" ON connection_requests;
CREATE POLICY "Users can view their own connection requests"
ON connection_requests
FOR SELECT
TO authenticated
USING (requester_id = auth.uid() OR recipient_id = auth.uid());

-- NOTE: the 'withdrawn' status and the requester-side transition below are
-- reserved for a future "cancel my sent request" feature. No RPC currently
-- sets this status -- it is schema-ready but not yet wired up to the app.
DROP POLICY IF EXISTS "Users can update their own connection requests" ON connection_requests;
CREATE POLICY "Parties can only perform allowed status transitions"
ON connection_requests
FOR UPDATE
TO authenticated
USING (
    (requester_id = auth.uid() AND status = 'pending')
    OR (recipient_id = auth.uid() AND status = 'pending')
)
WITH CHECK (
    (requester_id = auth.uid() AND status = 'withdrawn')
    OR (recipient_id = auth.uid() AND status IN ('accepted', 'declined'))
);

REVOKE ALL ON TABLE connection_requests FROM anon, authenticated;


--------------------------------------------------------------------------------
-- 1b. Canonical Friend Storage
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS friend_connections (
    user_low_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    user_high_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    PRIMARY KEY (user_low_id, user_high_id),
    CONSTRAINT friend_connections_no_self_connection CHECK (user_low_id <> user_high_id)
);

CREATE INDEX IF NOT EXISTS idx_friend_connections_user_low
    ON friend_connections(user_low_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friend_connections_user_high
    ON friend_connections(user_high_id, created_at DESC);

ALTER TABLE friend_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own friend connections" ON friend_connections;
CREATE POLICY "Users can view their own friend connections"
ON friend_connections
FOR SELECT
TO authenticated
USING (user_low_id = auth.uid() OR user_high_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove their own friend connections" ON friend_connections;
CREATE POLICY "Users can remove their own friend connections"
ON friend_connections
FOR DELETE
TO authenticated
USING (user_low_id = auth.uid() OR user_high_id = auth.uid());

REVOKE ALL ON TABLE friend_connections FROM anon, authenticated;


--------------------------------------------------------------------------------
-- 2. Send Connection Request RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION send_connection_request(
    target_peer_id UUID,
    request_message TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
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

        INSERT INTO connection_requests (
            requester_id,
            recipient_id,
            request_message,
            status,
            responded_at
        )
        VALUES (
            current_user_id,
            target_peer_id,
            cleaned_message,
            'accepted',
            NOW()
        )
        ON CONFLICT (requester_id, recipient_id)
        WHERE status = 'pending'
        DO UPDATE SET
            request_message = EXCLUDED.request_message,
            status = 'accepted',
            created_at = NOW(),
            responded_at = NOW();
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
$$ LANGUAGE plpgsql;


--------------------------------------------------------------------------------
-- 3. Incoming Requests RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_incoming_connection_requests(
    page_size INT DEFAULT 50,
    page_offset INT DEFAULT 0
)
RETURNS TABLE (
    request_id       UUID,
    requester_id     UUID,
    requester_name   TEXT,
    requester_major  TEXT,
    requester_year   INT,
    request_message  TEXT,
    created_at       TIMESTAMPTZ
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
$$ LANGUAGE plpgsql;


--------------------------------------------------------------------------------
-- 4. Accept Connection Request RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION accept_connection_request(
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

    INSERT INTO connection_requests (
        requester_id,
        recipient_id,
        request_message,
        status,
        responded_at
    )
    VALUES (
        current_user_id,
        request_row.requester_id,
        NULL,
        'accepted',
        NOW()
    )
    ON CONFLICT (requester_id, recipient_id)
    WHERE status = 'pending'
    DO UPDATE SET
        status = 'accepted',
        responded_at = NOW();
END;
$$ LANGUAGE plpgsql;


--------------------------------------------------------------------------------
-- 5c. Remove Friend Connection RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION remove_friend_connection(
    target_peer_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
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
$$ LANGUAGE plpgsql;


--------------------------------------------------------------------------------
-- 5b. Friends RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_friend_connections()
RETURNS TABLE (
    friend_id      UUID,
    friend_name    TEXT,
    friend_major   TEXT,
    friend_year    INT,
    created_at     TIMESTAMPTZ
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
        fc.created_at
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


--------------------------------------------------------------------------------
-- 5. Decline / Ignore Connection Request RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION decline_connection_request(
    request_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_user_id UUID := auth.uid();
BEGIN
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    UPDATE connection_requests
    SET status = 'declined',
        responded_at = NOW()
    WHERE id = request_id
      AND recipient_id = current_user_id
      AND status = 'pending';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Connection request not found.';
    END IF;
END;
$$ LANGUAGE plpgsql;


--------------------------------------------------------------------------------
-- 6. Privilege Hardening
--------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION send_connection_request(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_incoming_connection_requests(INT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION accept_connection_request(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION decline_connection_request(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_friend_connections() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION remove_friend_connection(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION send_connection_request(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_incoming_connection_requests(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION accept_connection_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_connection_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_friend_connections() TO authenticated;
GRANT EXECUTE ON FUNCTION remove_friend_connection(UUID) TO authenticated;
