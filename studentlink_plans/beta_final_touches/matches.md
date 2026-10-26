# Matches Page (`app/(tabs)/matching.tsx`)

## Current State Analysis
This page allows users to view recommended peers, send/receive connection requests, manage friends, and edit their shared bio (contact info shared only with accepted friends).

## Identified Issues & Areas for Improvement

### 1. Infinite "Bootstrapping" Loop
- **The Zero-Match Bug:** If a user has no matches (e.g., they are the first user at their school), the `fetchMatches` function assumes the matching engine just hasn't run yet. It triggers an expensive `recompute_scores_for_user` RPC call, shows a "Calculating matches..." loading spinner, and tries to fetch again. 
- **The Consequence:** Because they genuinely have 0 matches, the next fetch also returns 0. Every single time this user opens the Matches tab, the app will run a heavy database recomputation and show a long loading screen.
  - *Improvement:* The backend should track whether a user's matches are "stale" or "up to date". The frontend should not trigger a recompute just because the array is empty.

### 2. Optimistic UI Failures
- **Bio Update Rollback:** When editing the shared bio, the app updates the local context (`updateStudentData`) *before* calling the database. If the database update fails (e.g., network drop), the user's screen shows the new bio, but it wasn't actually saved. The local state is never rolled back.
  - *Improvement:* Either `await` the Supabase call before updating context, or implement a rollback mechanism in the `catch` block.

### 3. Redundant Data Fetching
- **Overfetching on Mount:** The page fires 4 parallel RPC queries (`matches`, `incoming`, `outgoing`, `friends`) every time the component mounts. 
  - *Improvement:* Cache this data in the global context or use a library like React Query with a stale-while-revalidate strategy to avoid spamming the database every time the user taps the tab.

### 4. Cross-School Matching?
- **School Validation:** The `MatchItem` interface includes `peer_school`. If the `get_matching_peers` RPC doesn't strictly filter by the current user's school, students from NorQuest might match with students from U of Alberta.
  - *Improvement:* Verify the `get_matching_peers` Postgres function strictly enforces `student1.school == student2.school` (unless cross-school matching is an intended feature).

## Proposed Action Items (Checklist)
- [ ] Remove the auto-triggering `recompute_scores_for_user` logic on empty match arrays to prevent DB thrashing.
- [ ] Fix the optimistic UI bug in the Bio Editor (await DB save before updating context).
- [ ] Optimize the 4x RPC fetching (implement caching or only refetch on manual pull-to-refresh).
- [ ] Audit the Postgres `get_matching_peers` function to ensure it filters by school.
