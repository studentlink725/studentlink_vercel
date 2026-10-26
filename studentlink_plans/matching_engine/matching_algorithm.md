# Technical Implementation Guide: StudentLink Matching Engine

This documentation outlines the internal mechanics of the StudentLink matching engine implemented in PostgreSQL (via Supabase). It is intended for developers who need to maintain, modify, or extend the matching algorithms and caching strategies.

## 1. Schema & Caching Architecture

The matching system avoids real-time, global similarity calculations by utilizing an asynchronous compute-and-cache model.

### Key Tables
*   **`students`**: The source of truth for user attributes. 
    *   *Modifiable flags*: `matching_enabled` controls visibility in the matching pool. `last_match_refresh` tracks the daily compute limit.
*   **`peer_similarity`**: A materialized cache storing pre-computed match scores.
    *   *Constraints*: Primary Key on `(user_id, peer_id)`.
    *   *Limit*: Designed to hold a maximum of 3 rows per `user_id`.
*   **`ignored_peers`**: A junction table (`user_id`, `peer_id`) functioning as a bidirectional blocklist.

### Critical Indexes
If you add new attributes to the matching algorithm, ensure you add appropriate indexes. Current performance indexes:
*   `idx_peer_similarity_lookup` on `peer_similarity(user_id, match_score DESC)` for fast read-path retrieval.
*   `idx_student_interests_student` and `idx_student_interests_interest` on `student_interests` to optimize the Jaccard similarity CTE joins.
*   `idx_ignored_peers_lookup` on `ignored_peers(user_id, peer_id)` to speed up exclusion filtering.

---

## 2. Core Algorithm: `recompute_scores_for_user()`

This PostgreSQL function is the workhorse of the engine. It calculates similarities and populates the `peer_similarity` cache.

### Function Signature
```sql
FUNCTION recompute_scores_for_user(
    current_user_id UUID,
    w_major NUMERIC DEFAULT 0.6,
    w_interests NUMERIC DEFAULT 0.4,
    bypass_cooldown BOOLEAN DEFAULT false
) RETURNS VOID
```

### Execution Flow & Modification Points
1.  **Cooldown Evaluation:** Checks `last_match_refresh`. The default cooldown is a calendar day boundary (`last_refresh::date >= NOW()::date`). 
    *   *To change to a rolling 24-hour window:* Update the condition to `last_refresh > NOW() - INTERVAL '24 hours'`.
2.  **Dynamic Normalization:** If a user lacks a major or interests, the algorithm dynamically re-weights the available parameters to equal 100%.
3.  **The Similarity Query:**
    *   Uses a CTE (`peer_interests`) to aggregate interest overlap using `COUNT(...) FILTER (WHERE ... IN (...))`.
    *   Calculates Jaccard Similarity: `Shared / (UserTotal + PeerTotal - Shared)`.
    *   *To add a new matching parameter (e.g., Club Affiliation):*
        1. Add `w_club NUMERIC` to the function parameters.
        2. Update the dynamic weighting variables (`total_weight`, `actual_w_club`).
        3. Add a new component to the `ROUND(... * 100)` projection in the main query.
4.  **Filtering & Constraints:**
    *   Hardcoded requirement: `s.school = my_school`. Matches do not cross school boundaries.
    *   Exclusion filters applied via `NOT IN (SELECT ... FROM ignored_peers)`.
5.  **Cache Insertion:** 
    *   Deletes all existing records for the `user_id` in `peer_similarity` before inserting.
    *   *To change the maximum number of matches returned:* Modify the `LIMIT 3` clause at the end of the query.

---

## 3. Read Path: `get_matching_peers()`

This function is invoked by the client application to fetch the user's dashboard matches. 

### Implementation Details
*   Retrieves from `peer_similarity` where `match_score > 0`.
*   Resolves UUIDs to human-readable text (Major name, dynamically grouping shared interest names into a `TEXT[]` array).
*   **Runtime Sanity Checks:** Even though scores are cached, the read query performs a live check on `students.matching_enabled = true` and cross-references `ignored_peers`. This ensures that if a peer disables their account *after* the cache was built, they still won't appear.

### Modification Points
*   *To return more data:* If the UI needs more data (like user avatars or shared courses), you must update the `RETURNS TABLE (...)` definition and add the corresponding `LEFT JOIN` and `SELECT` projection. Currently, `shared_courses` is mocked as `'{ }'::TEXT[]`.

---

## 4. State Management: `ignore_peer()`

Triggered when a user dismisses a match. 

### Implementation Details
1.  Inserts bidirectional relation into `ignored_peers`.
2.  Immediately issues a `DELETE FROM peer_similarity` for that specific pairing.

### Application Layer Responsibilities
**Important:** Calling `ignore_peer()` leaves the user with only 2 matches (or fewer) in their cache. The backend service or application layer must subsequently invoke `recompute_scores_for_user(user_id, bypass_cooldown := true)` to run the algorithm again, skip the daily lock, and find the next highest-scoring match to replenish the cache to 3.

---

## 5. Maintenance Operations

If you ever need to forcefully clear caches or adjust state:

*   **Wipe all caches:** `TRUNCATE TABLE peer_similarity;` (Users will auto-recompute on next login if app handles empty caches).
*   **Force global recalculation:** `UPDATE students SET last_match_refresh = '1970-01-01 00:00:00+00';`
*   **Purge zero-score matches:** `DELETE FROM peer_similarity WHERE match_score <= 0;` (Already handled by limits, but useful for cleanup).
