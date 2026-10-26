-- ============================================================
-- Add Bio Sharing, Profile Photo columns, and Storage setup
-- Run this in the Supabase SQL Editor as a transaction.
-- ============================================================

BEGIN;

-- 1. Add share_bio column to determine if the user's bio is visible to connections
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS share_bio BOOLEAN DEFAULT TRUE;

-- 2. Add avatar_url column to store the public URL of the user's profile photo
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 3. Recreate get_friend_connections() function to respect the share_bio setting
DROP FUNCTION IF EXISTS get_friend_connections();

CREATE OR REPLACE FUNCTION get_friend_connections()
RETURNS TABLE (
    friend_id      UUID,
    friend_name    TEXT,
    friend_major   TEXT,
    friend_year    INT,
    created_at     TIMESTAMPTZ,
    bio_line       TEXT,
    avatar_url     TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
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

GRANT EXECUTE ON FUNCTION get_friend_connections() TO authenticated;

-- 4. Create the public 'avatars' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 5. Enable Storage security policies for the 'avatars' bucket
-- Drop existing policies first to prevent conflicts
DROP POLICY IF EXISTS "Public Select Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;

-- Allow public select/read access to all avatars
CREATE POLICY "Public Select Access"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Allow authenticated users to insert their own avatar
CREATE POLICY "Authenticated Insert Access"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own avatar
CREATE POLICY "Authenticated Update Access"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own avatar
CREATE POLICY "Authenticated Delete Access"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

COMMIT;
