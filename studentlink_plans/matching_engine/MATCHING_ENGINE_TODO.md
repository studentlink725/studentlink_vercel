# Matching Engine Implementation Checklist

This checklist tracks the implementation steps for milestone **B4: Interests-Based Matching** in StudentLink, adhering to the design document at `studentlink_plans/studentlink_matching_engine.md` while mapping to the existing project schemas.

---

## Phase 1: Database Migration (`studentlink_matching_migration.sql`)
- [x] **Task 1.1: Schema Modifications**
  - Add `matching_enabled` (boolean, default true) to `students` table.
  - Add `last_match_refresh` (timestamptz) to `students` table.
  - Create table `peer_similarity` with columns:
    - `user_id` UUID REFERENCES students(id) ON DELETE CASCADE
    - `peer_id` UUID REFERENCES students(id) ON DELETE CASCADE
    - `match_score` NUMERIC
    - `computed_at` TIMESTAMPTZ DEFAULT NOW()
    - Primary key: `(user_id, peer_id)`
  - Create index `idx_peer_similarity_lookup` on `peer_similarity(user_id, match_score DESC)`.
  - Create indexes on `student_interests(student_id)` and `student_interests(interest_id)`.
- [x] **Task 1.2: Trigger for New User Bootstrap**
  - Create trigger function `queue_new_user_for_matching()` to set `NEW.last_match_refresh = '1970-01-01'::TIMESTAMPTZ`.
  - Create `BEFORE INSERT` trigger `on_new_student` on `students`.
- [x] **Task 1.3: Background Score Recomputation Function**
  - Create PG function `recompute_scores_for_user(current_user_id UUID, w_major NUMERIC, w_interests NUMERIC)`:
    - Calculates Jaccard similarity score on `student_interests`/`interests`.
    - Handles dynamic weight normalization.
    - Limits to top 3 matches for the user.
    - Updates `last_match_refresh` to `NOW()`.
- [x] **Task 1.4: Matching Results Fetch Function**
  - Create PG function `get_matching_peers(current_user_id UUID)`:
    - Joins `peer_similarity` with `students`, `majors`, and `student_interests` to aggregate name, year, major, and shared interests array.
    - Filters out matches where `matching_enabled = false` or the target user is themselves.
- [x] **Task 1.5: Schedule Setup (pg_cron)**
  - Document/setup the pg_cron schedule to refresh scores every 30 minutes for users whose 24-hour cooldown has elapsed.

---

## Phase 2: Privacy Opt-In Integration
- [x] **Task 2.1: Context Refactoring (`persona-context.tsx`)**
  - Include `matching_enabled` in `StudentData` interface.
  - Expose `matching_enabled` state and fetch it from the database.
- [x] **Task 2.2: Profile Toggle Switch (`profile.tsx`)**
  - Add a "Matching Discovery" option to the profile settings menu.
  - Implement a toggle switch to enable/disable `matching_enabled`.
  - Set up instant local UI toggling and background database update.

---

## Phase 3: Client-Side Fetching & Bootstrap
- [x] **Task 3.1: Instant First-Load Bootstrap Logic**
  - In the Matches screen, fetch matches from `get_matching_peers`.
  - If the list is empty, call `recompute_scores_for_user` dynamically via Supabase RPC to bootstrap the matches list instantly, then fetch the results again.
- [x] **Task 3.2: Error Handling & Loading States**
  - Gracefully handle empty match feeds (e.g. no students at the same school, or no overlap).
  - Add clean loader spinners during the bootstrap step.

---

## Phase 4: Peer Matching UI (`app/(tabs)/matching.tsx`)
- [x] **Task 4.1: Custom Card Design**
  - Display peer's initials, name, year, program.
  - Add visual match percentage indicator (e.g. circular progress or progress bar).
  - Display categorized shared interest badges (e.g. `Tech & Innovation: Coding` parsed as `Coding`).
- [x] **Task 4.2: User Action Handlers**
  - Add a "Connect" button that updates local UI state (visual feedback only for Beta).
  - Ensure scroll behavior is smooth and performs well.

---

## Phase 5: Verification & Safety Checklist
- [x] **Task 5.1: Type Safety Checks**
  - Run `npx tsc --noEmit` and confirm zero compiler errors.
- [x] **Task 5.2: Security & Row Level Security (RLS) Check**
  - Verify that matching data is accessed safely via the `SECURITY DEFINER` RPC without exposing raw private columns.
- [x] **Task 5.3: Git Commit**
  - Commit all checklist files and functional modifications.
