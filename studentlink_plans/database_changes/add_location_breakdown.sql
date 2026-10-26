-- ============================================================
-- Add Location Breakdown columns (city, province_state, country)
-- and backfill them from the existing location column.
-- Run this in the Supabase SQL Editor.
-- ============================================================

BEGIN;

-- 1. Add new columns to events table if they do not exist
ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS province_state TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

-- 2. Backfill existing records
-- Splits by comma and trims. Handles "City, Province, Country" pattern
UPDATE public.events
SET
  city = CASE 
    WHEN array_length(regexp_split_to_array(location, '\s*,\s*'), 1) >= 1 THEN 
      trim(regexp_replace((regexp_split_to_array(location, '\s*,\s*'))[1], '\+\s*Google\s*Map\s*', '', 'gi'))
    ELSE NULL
  END,
  province_state = CASE 
    WHEN array_length(regexp_split_to_array(location, '\s*,\s*'), 1) >= 2 THEN 
      trim(regexp_replace((regexp_split_to_array(location, '\s*,\s*'))[2], '\+\s*Google\s*Map\s*', '', 'gi'))
    ELSE NULL
  END,
  country = CASE 
    WHEN array_length(regexp_split_to_array(location, '\s*,\s*'), 1) >= 3 THEN 
      trim(regexp_replace((regexp_split_to_array(location, '\s*,\s*'))[3], '\+\s*Google\s*Map\s*', '', 'gi'))
    ELSE NULL
  END
WHERE location IS NOT NULL;

-- 3. Clean up the existing location column to strip out '+ Google Map' etc.
UPDATE public.events
SET location = regexp_replace(
  regexp_replace(
    regexp_replace(location, '\+\s*Google\s*Map\s*', '', 'gi'),
    '\+\s*iCal\s*Export', '', 'gi'
  ),
  '\+\s*Google\s*Calendar', '', 'gi'
)
WHERE location IS NOT NULL;

COMMIT;
