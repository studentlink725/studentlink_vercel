# StudentLink: Weighted Jaccard Matching — Design Document

This document details the algorithm, mathematical formulations, security handling, database schemas, and scaling strategy for milestone **B4: Interests-Based Matching** in StudentLink.

---

## 1. Weighted Similarity Matching Algorithm

To calculate matching scores between the `current_user` and any `peer_user`, we use a weighted multi-attribute score that prioritizes academic compatibility while valuing personal connections.

### Current Formula (MVP — Major + Interests)

$$\text{Match Score} = w_{\text{major}} \cdot S_{\text{major}} + w_{\text{interests}} \cdot S_{\text{interests}}$$

Where:

- **Major Similarity ($S_{\text{major}}$)**:
  - $1.0$ if `me.major_id = peer.major_id`
  - $0.0$ if they do not match or are null
- **Interests Similarity ($S_{\text{interests}}$)**:
  - Standard Jaccard Set Similarity over interest ID sets:
    $$S_{\text{interests}} = \frac{|I_{\text{me}} \cap I_{\text{peer}}|}{|I_{\text{me}} \cup I_{\text{peer}}|}$$
  - If the union is empty, $S_{\text{interests}} = 0$

### Default Weights

| Attribute  | Weight |
|------------|--------|
| Major      | 0.6    |
| Interests  | 0.4    |

### Future Formula (Courses Added)

When courses are introduced, the formula scales to:

$$\text{Match Score} = w_{\text{courses}} \cdot S_{\text{courses}} + w_{\text{major}} \cdot S_{\text{major}} + w_{\text{interests}} \cdot S_{\text{interests}}$$

Where:

- **Courses Similarity ($S_{\text{courses}}$)**:
  $$S_{\text{courses}} = \frac{|C_{\text{me}} \cap C_{\text{peer}}|}{|C_{\text{me}} \cup C_{\text{peer}}|}$$

| Attribute  | Weight |
|------------|--------|
| Courses    | 0.5    |
| Major      | 0.3    |
| Interests  | 0.2    |

> Weights are stored as function parameters, not hardcoded, so they can be tuned without a schema change or code deploy.

---

## 2. Dynamic Weight Normalization

If a student has omitted optional fields (e.g. no interests selected), a rigid weighted sum would cap their maximum match score below 100%. To prevent this, weights are normalized dynamically at query time based on which categories are populated.

**Normalization formula for attribute $i$:**

$$\hat{w}_i = \frac{w_i}{\sum_{j \in \text{Available}} w_j}$$

**Current behavior:**

- If $|I_{\text{me}}| = 0$: `w_interests` is zeroed out and `w_major` normalizes to 1.0
- This ensures scores always span the full 0%–100% range regardless of profile completeness

> **Known edge case:** Dynamic normalization currently checks only the current user's populated fields, not the peer's. A peer with zero interests will always score purely on major similarity for that dimension. This is acceptable behavior but should be a conscious decision — if desired, per-peer weight normalization can be added at the cost of query complexity.

---

## 3. Anti-Gaming Strategy & Score Staleness

### The Problem

If scores update immediately when a user changes their interests or major, motivated users can cycle through combinations to locate specific people — a significant concern in small university cohorts where users may know roughly who they are looking for.

### The Solution: Intentional Staleness

Scores are **not** updated in real time. Instead, each user's scores are refreshed on a 24-hour cooldown. This is presented to users as a deliberate product feature:

> "Your matches refresh daily."

This sets an expectation that feels intentional rather than a technical limitation, and eliminates the incentive to game interest changes.

### Per-User Refresh Tracking

A `last_match_refresh` timestamp column on the `students` table controls when each user's scores are recomputed:

```sql
ALTER TABLE students ADD COLUMN last_match_refresh TIMESTAMPTZ;
```

The scheduled job (see Section 6) only recomputes users whose refresh is due:

```sql
SELECT recompute_scores_for_user(id)
FROM students
WHERE last_match_refresh IS NULL
   OR last_match_refresh < now() - INTERVAL '24 hours';
```

### Rate Limiting Interest Changes

Even though interest changes do not immediately affect scores, log change frequency. Users changing interests more than ~10 times in a short window is a signal worth flagging for review, even if it has no immediate product effect.

---

## 4. Database Schema

```sql
-- Interests
CREATE TABLE interests (
    id   INT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE user_interests (
    user_id     UUID REFERENCES auth.users(id),
    interest_id INT  REFERENCES interests(id),
    PRIMARY KEY (user_id, interest_id)
);

-- Majors
CREATE TABLE majors (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    major TEXT NOT NULL
);

-- Courses (future — schema ready now)
CREATE TABLE classes (
    id   INT PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE user_classes (
    user_id  UUID REFERENCES auth.users(id),
    class_id INT  REFERENCES classes(id),
    PRIMARY KEY (user_id, class_id)
);

-- Students
CREATE TABLE students (
    id                 UUID PRIMARY KEY REFERENCES auth.users(id),
    name               TEXT,
    school             TEXT,
    year               INT,
    major_id           UUID REFERENCES majors(id),
    matching_enabled   BOOLEAN DEFAULT true,
    last_match_refresh TIMESTAMPTZ
);

-- Pre-computed similarity scores (top 3 per user)
CREATE TABLE peer_similarity (
    user_id      UUID REFERENCES students(id),
    peer_id      UUID REFERENCES students(id),
    match_score  NUMERIC,
    computed_at  TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (user_id, peer_id)
);

CREATE INDEX idx_peer_similarity_lookup
    ON peer_similarity(user_id, match_score DESC);
```

### Required Indexes

```sql
CREATE INDEX idx_student_interests_student  ON user_interests(user_id);
CREATE INDEX idx_student_interests_interest ON user_interests(interest_id);
CREATE INDEX idx_students_school            ON students(school);
CREATE INDEX idx_students_major             ON students(major_id);
```

Without indexes on `user_interests(user_id)` and `user_interests(interest_id)`, the correlated subquery inside the Jaccard aggregate runs as a sequential scan per peer — this becomes slow quickly.

---

## 5. Security & RLS Bypass

Standard Row Level Security restricts user SELECT statements to `auth.uid() = id`, meaning students cannot read other students' interest profiles directly.

**Solution:** A PostgreSQL function marked `SECURITY DEFINER` runs with database owner privileges internally, but returns only a restricted set of safe columns. Users who have opted out of matching are excluded via the `matching_enabled` flag.

The function returns: initials, program, year, score, and shared interests. Private profile details are never exposed.

---

## 6. Pre-Computed Matching & Scheduling

### Why Pre-Computation

Running a full Jaccard scan against all peers in a school on every request is O(N) per call. At small scale this is fine, but 50 concurrent users each triggering a full scan creates compounding load. Pre-computing scores and storing them turns the matching screen query into a simple indexed lookup — microseconds regardless of school size.

### Bounded Storage

We store only the **top 3 matches per user**, not all pairwise scores. At 10k users this produces at most 30k rows rather than ~50 million.

```sql
INSERT INTO peer_similarity (user_id, peer_id, match_score)
SELECT $1, peer_id, score
FROM compute_scores_for_user($1)
ORDER BY score DESC
LIMIT 3
ON CONFLICT (user_id, peer_id) DO UPDATE
    SET match_score  = EXCLUDED.match_score,
        computed_at  = now();
```

The matching screen query becomes:

```sql
SELECT peer_id, match_score
FROM peer_similarity
WHERE user_id = $1
ORDER BY match_score DESC
LIMIT 20;
```

### pg_cron Scheduled Refresh

A Supabase pg_cron job runs every 30 minutes and recomputes only users whose 24-hour cooldown has elapsed:

```sql
SELECT cron.schedule(
    'refresh-match-scores',
    '*/30 * * * *',
    $$ 
        SELECT recompute_scores_for_user(id)
        FROM students
        WHERE matching_enabled = true
          AND (last_match_refresh IS NULL
               OR last_match_refresh < now() - INTERVAL '24 hours');
    $$
);
```

### New User Bootstrap

New users have `last_match_refresh = NULL`, which the cron job treats as immediately due. To ensure their first app open does not show an empty matching screen, a trigger flags them for the next cron run at the moment of registration:

```sql
CREATE OR REPLACE FUNCTION queue_new_user_for_matching()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE students
    SET last_match_refresh = '1970-01-01'
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_new_student
AFTER INSERT ON students
FOR EACH ROW EXECUTE FUNCTION queue_new_user_for_matching();
```

This means new users will have computed matches within 30 minutes of registration without any special onboarding logic in the app.

---

## 7. PostgreSQL Function (`get_matching_peers`)

```sql
CREATE OR REPLACE FUNCTION get_matching_peers(
    current_user_id UUID,
    w_major         NUMERIC DEFAULT 0.6,
    w_interests     NUMERIC DEFAULT 0.4
)
RETURNS TABLE (
    peer_id          UUID,
    peer_name        TEXT,
    peer_school      TEXT,
    peer_year        INT,
    peer_major       TEXT,
    shared_interests TEXT[],
    shared_courses   TEXT[],
    match_percentage NUMERIC
) SECURITY DEFINER AS $$
DECLARE
    my_school          TEXT;
    my_major_id        UUID;
    my_interest_count  INT;
    actual_w_major     NUMERIC;
    actual_w_interests NUMERIC;
    total_weight       NUMERIC;
BEGIN
    -- 1. Gather current student context
    SELECT school, major_id
    INTO my_school, my_major_id
    FROM students
    WHERE id = current_user_id;

    -- 2. Count current student's interests
    SELECT COUNT(*)
    INTO my_interest_count
    FROM user_interests
    WHERE user_id = current_user_id;

    -- 3. Normalize weights based on populated profile fields
    total_weight       := w_major + (CASE WHEN my_interest_count > 0 THEN w_interests ELSE 0 END);
    actual_w_major     := w_major / total_weight;
    actual_w_interests := (CASE WHEN my_interest_count > 0 THEN w_interests ELSE 0 END) / total_weight;

    RETURN QUERY
    WITH peer_interests AS (
        SELECT
            si.user_id,
            COUNT(DISTINCT si.interest_id) AS interest_count,
            COUNT(si.interest_id) FILTER (WHERE si.interest_id IN (
                SELECT interest_id FROM user_interests WHERE user_id = current_user_id
            )) AS shared_count,
            ARRAY_AGG(i.name) FILTER (WHERE si.interest_id IN (
                SELECT interest_id FROM user_interests WHERE user_id = current_user_id
            )) AS shared_names
        FROM user_interests si
        JOIN interests i ON i.id = si.interest_id
        WHERE si.user_id != current_user_id
        GROUP BY si.user_id
    )
    SELECT
        s.id                                        AS peer_id,
        s.name                                      AS peer_name,
        s.school                                    AS peer_school,
        s.year                                      AS peer_year,
        m.major                                     AS peer_major,
        COALESCE(pi.shared_names, '{}'::text[])     AS shared_interests,
        '{}'::text[]                                AS shared_courses,  -- Placeholder until courses are implemented
        ROUND(
            (
                -- Major component
                (CASE WHEN s.major_id = my_major_id THEN actual_w_major ELSE 0 END)
                +
                -- Interests Jaccard component
                (CASE
                    WHEN NULLIF(
                        my_interest_count
                        + COALESCE(pi.interest_count, 0)
                        - COALESCE(pi.shared_count, 0),
                    0) IS NOT NULL
                    THEN actual_w_interests * (
                        COALESCE(pi.shared_count, 0)::NUMERIC
                        / (my_interest_count + COALESCE(pi.interest_count, 0) - COALESCE(pi.shared_count, 0))
                    )
                    ELSE 0
                END)
            ) * 100,
        0) AS match_percentage
    FROM students s
    LEFT JOIN majors m         ON m.id = s.major_id
    LEFT JOIN peer_interests pi ON pi.user_id = s.id
    WHERE s.id            != current_user_id
      AND s.school         = my_school
      AND s.matching_enabled = true          -- Respect opt-out
    ORDER BY match_percentage DESC;
END;
$$ LANGUAGE plpgsql;
```

---

## 8. Candidate Filtering Optimization

Before full scoring runs, narrow the candidate pool to peers who share at least one interest or the same major. In practice this cuts the scoring population by 80–90% and requires no architecture changes.

```sql
WITH candidates AS (
    SELECT DISTINCT si.user_id AS peer_id
    FROM user_interests si
    WHERE si.interest_id IN (
        SELECT interest_id FROM user_interests WHERE user_id = $1
    )
    AND si.user_id != $1

    UNION

    SELECT id AS peer_id
    FROM students
    WHERE major_id = (SELECT major_id FROM students WHERE id = $1)
      AND id != $1
)
-- Run scoring logic only against candidates
```

Peers with zero overlap across all dimensions are not useful matches in a social product, so excluding them from scoring is both a performance and product improvement.

---

## 9. Scaling Strategy by Phase

### Beta (100–500 users)

At this scale, performance is not a concern. The priority is **validating match quality**. Instrument everything:

- What scores are users actually receiving?
- Do users engage with their top matches or scroll past them?
- Are the default weights (0.6 major / 0.4 interests) producing matches users find meaningful?

Use this data to tune weights before official release. Getting the weights right is more valuable than any technical optimization at this stage. School-level partitioning (`s.school = my_school`) means effective N is users per school, not total users — making the computation trivial even as total signups grow.

### Official Release (1k–10k users)

This is where architecture matters. Key targets:

- `peer_similarity` table populated for all existing users **before launch day** so no user hits a cold cache on day one
- pg_cron running on 30-minute intervals covering new registrations and due refreshes
- Bounded top-3 storage keeps `peer_similarity` at ~30k rows maximum at 10k users across schools

At this scale, the pre-computed lookup approach comfortably handles the load without Edge Functions or external infrastructure.

### Future (10k+ users)

If Postgres becomes the bottleneck — measure first, do not assume — the next step is moving batch score computation into a Supabase Edge Function running outside the database. This allows horizontal scaling of the compute without touching the query or schema layer. Only relevant once a real measured bottleneck exists.

---

## 10. Known Limitations & Future Improvements

**Major similarity is binary.** Two students in "Computer Science" and "Computer Engineering" receive a 0. A `major_categories` table with partial credit for related majors (e.g. 0.4 for adjacent fields) would improve match quality significantly.

**All interests are weighted equally.** A rare shared interest (e.g. a niche hobby) carries the same weight as a common one (e.g. "music"). TF-IDF weighted cosine similarity would address this but adds meaningful complexity — defer until Jaccard quality is validated.

**`shared_courses` is a placeholder.** When courses are added, the function signature will need updating. Version the function as `get_matching_peers_v2` at that point to avoid breaking existing frontend RPC calls.
