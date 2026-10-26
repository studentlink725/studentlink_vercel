# Database Analysis

## Critical: Authorization bypass in several `SECURITY DEFINER` functions

This is the worst problem in the file. `ignore_peer(current_user_id, ignored_peer_id)` takes `current_user_id` as a plain argument and never checks it against `auth.uid()`. It's `SECURITY DEFINER` and granted to `anon` and `authenticated`. That means any caller — including an unauthenticated `anon`-key client — can pass any two student UUIDs and delete another student's `peer_similarity` rows or insert `ignored_peers` records on their behalf. There is nothing in the function body stopping impersonation.

`get_matching_peers(current_user_id uuid DEFAULT NULL)` has the same shape: it accepts an explicit ID and only falls back to `auth.uid()` if the argument is omitted. Anyone can call `get_matching_peers('some-other-students-uuid')` and read that student's match list, shared interests, and match percentages. This defeats the entire point of having `auth.uid()`-gated logic elsewhere.

`recompute_scores_for_user(current_user_id, ...)` is the same pattern again, also with a `bypass_cooldown` flag exposed to callers — anyone can force expensive recomputation for arbitrary student IDs on demand, which is a resource-abuse vector even if it doesn't leak data directly.

Compare these to `accept_connection_request`, `decline_connection_request`, `remove_friend_connection`, `withdraw_connection_request` — all of which correctly declare `current_user_id UUID := auth.uid()` internally and never accept it as a parameter. That's the right pattern. The three functions above broke it, and the break is exploitable, not theoretical. This needs to be fixed by removing the parameter and using `auth.uid()` directly, full stop.

**Fix direction:**
- Drop the `current_user_id` parameter from `ignore_peer`, `get_matching_peers`, and `recompute_scores_for_user`.
- Replace all internal references with `auth.uid()`, and raise an exception if it's null, matching the pattern already used elsewhere in this file.

## Critical: RLS enablement status is unclear

You have an `rls_auto_enable()` event trigger function defined, but this dump does not contain the actual `CREATE EVENT TRIGGER ... EXECUTE FUNCTION rls_auto_enable()` statement, and it does not contain a single explicit `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` for any table — not `students`, not `connection_requests`, not `friend_connections`, nothing. A `pg_dump` normally captures both of those if they exist.

This matters given the blanket `GRANT ALL ON TABLES TO anon, authenticated` from `ALTER DEFAULT PRIVILEGES`. Table grants and RLS are two separate gates — grants say "you're allowed to try this command," RLS says "you're allowed to touch this row." If RLS is not actually enabled on these tables, the grants are the *only* gate, and `GRANT ALL` means `anon` can `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on `students` (names, emails, bios), `connection_requests`, `friend_connections`, `peer_similarity`, `ignored_peers` — everything. The two RLS policies that do exist on `connection_requests` and `friend_connections` would be dead code, sitting there doing nothing, because they never got attached to an RLS-enabled table.

There's a second possibility that's almost as bad: if the event trigger is live somewhere outside this dump and RLS is enabled on everything, then `courses`, `majors`, `interests`, `events`, `students`, `peer_similarity`, `student_courses`, `student_interests`, and `scrape_runs` have zero policies defined anywhere in this file — meaning default-deny locks out `anon`/`authenticated` entirely, including read access to things like the majors/interests lookup lists or the public events feed, which are clearly meant to be browsable. That would break the app rather than leak data, but it's still a real gap that needs explaining.

**Action:** don't guess — run these against the live database:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
SELECT evtname FROM pg_event_trigger;
```
This is the difference between "fine" and "every student's email and match data is publicly readable and writable right now." Resolve this before anything else on this list.

## Design oddity: reciprocal row insertion in connection requests

In both `accept_connection_request` and the reciprocal branch of `send_connection_request`, when a connection completes, the code inserts a *second* `connection_requests` row in the opposite direction, pre-marked `'accepted'`, using an `ON CONFLICT (requester_id, recipient_id) WHERE status = 'pending'` upsert against the partial unique index. The intent seems to be keeping request history symmetric so `get_incoming_connection_requests` / `get_outgoing_connection_requests` reads make sense from both sides.

But it means a single accepted connection can produce two rows in `connection_requests`, one of which was never a real request the other person "sent" — it's synthesized. If any other part of the app (or you, six months from now) assumes one row per real request event, this will produce confusing or double-counted history. Worth a comment in the migration explaining why, at minimum.

## Minor: unused `courses` / `student_courses` infrastructure

`recompute_scores_for_user` only takes `w_major` and `w_interests` weights — `student_courses` and `courses` are fully populated tables with no role in the matching algorithm. `get_matching_peers` even hardcodes `shared_courses` as `'{}'::TEXT[]` always, never computed. Either this is a planned-but-unshipped feature or dead schema. Worth confirming which, since dead tables with open grants are exactly the kind of thing that becomes a forgotten attack surface.

## Minor: match staleness is one-directional

`recompute_scores_for_user` only updates *your* outgoing similarity rows when *you* trigger it (e.g., on login). If Alice changes her major, Bob's existing `peer_similarity` row pointing at Alice doesn't update until Bob himself triggers a recompute and his own daily cooldown allows it. So match data can silently drift out of sync between two users for up to a day, or longer for inactive users. That may be an acceptable tradeoff for cost reasons, but it's worth being a deliberate decision rather than an accident — a background job re-scoring everyone nightly would close this gap if one doesn't already exist outside this dump.

## Minor: benign race in `send_connection_request`

If two users send each other requests at the exact same instant, both can pass the "does a reciprocal pending request already exist" check before either row is committed, resulting in two separate pending rows instead of an auto-accepted friendship. Not exploitable, just a correctness edge case under true concurrency — low priority.

## Bottom line

Two blocking issues before anything else matters:
1. Fix the three `SECURITY DEFINER` functions that accept `current_user_id` as a caller-supplied argument instead of deriving it from `auth.uid()`.
2. Confirm, directly against the live database, whether RLS is actually enabled on every `public` table — the answer changes whether this schema is "solid" or "wide open."

