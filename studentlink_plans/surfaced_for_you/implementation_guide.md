# "Surfaced for You" Implementation Guide (Revised)

End-to-end developer guide for Milestone B6: automated event and news aggregation from NorQuest and SANQC (and future sources), with AI-assisted tagging/normalization/deduplication, surfaced to users based on interests.

**Revision notes from planning discussion:**
- Confirmed GitHub Actions (not a self-hosted server) as the scraping runtime — it already is the "boot, run, shut down" model being considered, at no cost under current usage.
- Redesigned for many future sources, not just two: source registry pattern instead of bespoke per-site scripts.
- Added an AI enrichment step (tagging, normalization, deduplication, summarization) using a direct provider (OpenAI), scoped to text-only tasks for this milestone.
- Image recognition (e.g., M4 class schedule parsing) is explicitly **out of scope for B6**. It's noted here only as a forward-looking architectural consideration so the provider choice doesn't need to be revisited later.

---

## 1. Architecture & Tech Stack

**Runtime:** Node.js (TypeScript), consistent with the React Native app's ecosystem.

**Scheduling/Automation:** GitHub Actions (cron). Not a self-managed server.

- GitHub Actions already provides the "spin up, run, shut down, pay only for what you use" behavior a manually managed server would attempt to replicate — Actions runners just do it for free under current volume (2,000 min/month on private repos, 6-hour job ceiling, 2 core / 7GB RAM per runner).
- A self-hosted server that boots and shuts down would still need something external to trigger the boot/shutdown on schedule — which just re-implements what GitHub Actions cron already does, with more infrastructure to maintain.
- **Only revisit this** if cumulative scrape+enrichment time approaches the 6-hour job ceiling or the 2,000 min/month budget, if sites start rate-limiting/banning GitHub's runner IP ranges, or if a scraper needs resources (concurrency, memory, persistent state) the runner can't provide. If that happens, the correct next step is a managed serverless container job (e.g., Cloud Run Jobs, Fargate scheduled tasks) — not a manually managed VM.

**Libraries:**
- `axios` / `node-fetch` — HTTP requests to APIs or RSS feeds.
- `cheerio` — HTML parsing for SSR/static pages.
- `puppeteer` / `playwright` — only for heavily client-side rendered (SPA) sites cheerio can't read.
- `rss-parser` — for sources with RSS/Atom feeds (e.g., SANQC's WordPress feed, if present).
- `@supabase/supabase-js` — push normalized/enriched data into Supabase.
- OpenAI SDK — for the AI enrichment step (see Section 6).

**Scalability requirement — Source Registry Pattern:**

Because more sources will be added continuously, each source must be a self-contained module implementing a common interface, not a one-off script:

```typescript
interface EventSource {
  id: string;               // e.g., 'norquest_myquest', 'sanqc'
  fetch(): Promise<RawEvent[]>;
  normalize(raw: RawEvent[]): NormalizedEvent[];
}
```

Adding a new source means writing one new module and registering it — it should never require touching the orchestration script. Use a matrix strategy in GitHub Actions (Section 7) to run sources in parallel rather than sequentially, which buys significant headroom before hitting any time limits as source count grows.

---

## 2. Database Schema (Supabase)

### `events` table

```sql
CREATE TABLE public.events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    source VARCHAR NOT NULL, -- e.g., 'norquest_myquest', 'sanqc'
    external_id VARCHAR UNIQUE, -- ID from the source to prevent duplicates
    title VARCHAR NOT NULL,
    description TEXT,
    summary TEXT, -- AI-generated short summary for card UI
    url VARCHAR NOT NULL,
    image_url VARCHAR,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    location VARCHAR,
    tags TEXT[], -- Must be drawn from a fixed taxonomy (see Section 6)
    tagged_by VARCHAR NOT NULL DEFAULT 'keyword', -- 'ai' | 'keyword' — for auditability
    duplicate_of UUID REFERENCES public.events(id), -- nullable; set if AI dedup flags this as a duplicate
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

`external_id` keeps its UNIQUE constraint for UPSERT-based daily scrapes. `tagged_by` and `duplicate_of` are new — they exist so tagging and dedup decisions are auditable rather than opaque, and so a bad AI call never silently corrupts data (it's visible and reversible).

### `scrape_runs` table (new)

```sql
CREATE TABLE public.scrape_runs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    source VARCHAR NOT NULL,
    status VARCHAR NOT NULL, -- 'success' | 'partial' | 'failed'
    items_found INTEGER,
    error TEXT,
    ai_enrichment_status VARCHAR, -- 'success' | 'fallback' | 'skipped'
    run_at TIMESTAMPTZ DEFAULT NOW()
);
```

This exists so source degradation (a scraper silently breaking, an AI call consistently failing) shows up as data you can query, rather than something you only notice weeks later when a source goes stale. This table is also the thing to check before deciding whether to move off GitHub Actions — decide based on measured usage, not anticipated usage.

---

## 3. Data Acquisition Strategy

### Phase A: NorQuest MyQuest

1. **API access (preferred):** Contact NorQuest IT / check for a MyQuest developer portal. If granted, fetch via `axios`.
2. **Scraping (fallback):** Check DevTools Network tab for a hidden internal API the frontend calls. If none, use `cheerio` against DOM elements (`.event-card`, `.event-title`, etc.).

### Phase B: SANQC

1. **RSS/Atom feed (preferred):** Check `sanqc.ca/feed` or `sanqc.ca/events/feed`. Use `rss-parser`.
2. **Scraping (fallback):** Target `sanqc.ca/events` with `cheerio`.

Each of these becomes one `EventSource` module under the registry pattern in Section 1 — write them as if a third and fourth source are already known to be coming, since they are.

---

## 4. Scraper Workflow, Normalization & AI Enrichment

**Pipeline:**

```
Fetch → Normalize → AI Enrichment (tag + dedupe + summarize) → Upsert
```

### Fetch & Normalize
Run all registered sources in parallel (`Promise.all` within a job, or matrix jobs across sources — see Section 7). Each source's `normalize()` maps its raw structure into the unified `events` schema.

### AI Enrichment (new step)

**Provider decision:** OpenAI, direct API — not OpenRouter, not a second provider for a hypothetical future task.

- OpenRouter's value is multi-model flexibility; this project doesn't need it for a fixed, well-defined task set, so it would only add a markup and an extra failure point for no benefit.
- The tagging/normalization/dedup/summarization tasks here are text-only. Do not factor image recognition into this decision — it's not part of B6, and speculative future needs shouldn't drive today's provider choice without an actual second use case in front of you.
- **Cost is a non-issue for this milestone at current scale:** ballpark estimate is roughly $3-4 CAD per institution per year for tagging alone across ~80 posts/month, using a cheap model. This is not a line item worth optimizing further right now — don't spend more design effort on it than the ~$1/year difference between model choices actually justifies.
- Use a cheap, fast model (e.g., a GPT-4o-mini class model) for these tasks. They are classification/extraction/comparison tasks, not tasks that need a top-tier reasoning model.

**Four tasks, one batched call per run (not four separate calls per event):**

1. **Tagging** — classify each event against a **fixed, closed taxonomy** (e.g., Academic, Social, Career, Wellness, Volunteering, Athletics), not free-form tag generation. Free-form tagging will produce near-duplicate tag strings ("Volunteering" vs "Volunteer Opportunity") that silently break `user.interests.includes(tag)` matching. Validate the AI's output against the interests table in the database; reject/fallback on anything outside it.
2. **Normalization** — clean up inconsistent title/description formatting across sources. Use a proper date-parsing library for dates/times, not the LLM — that's a case where a deterministic tool beats AI.

3. **Deduplication** — this is comparative, not per-event, so it must be handled differently from the other three: pre-filter candidate pairs by simple heuristics first (same week, similar title via string similarity), and only send genuinely ambiguous pairs to the LLM for a same/different judgment. Sending every new event against every existing event to the LLM is quadratic cost for no reason and the actual risk if this step is skipped.
4. **Summarization** — 1-2 sentence clean summary for card UI, generated from the (possibly messy) scraped description.

**Failure handling (extends the existing scraper failure discipline to this step):**
- If the AI call times out, hits a rate limit, or returns malformed/out-of-schema JSON: catch it, fall back to the keyword matcher for tags on that batch, skip dedup/summarization for the affected events, log `ai_enrichment_status = 'fallback'` in `scrape_runs`, and continue the upsert. The AI step failing must never crash the job or block a successful scrape from being saved — same principle as "if SANQC breaks, still upsert NorQuest."
- Validate every AI response against a strict JSON schema before it reaches the upsert call, regardless of which task produced it.

### Upsert to Supabase

```javascript
const { data, error } = await supabase
  .from('events')
  .upsert(normalizedEvents, { onConflict: 'external_id' });
```

Never wipe the table before a scrape. Always upsert.

---

## 5. Scheduling (GitHub Actions)

`.github/workflows/scraper.yml`:

```yaml
name: Daily Event Scraper
on:
  schedule:
    - cron: '0 8 * * *' # 8:00 AM UTC / 2:00 AM MDT
  workflow_dispatch:
jobs:
  scrape:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        source: [norquest, sanqc] # add new sources here as they're built
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
        working-directory: ./scrapers
      - run: node index.js --source=${{ matrix.source }}
        working-directory: ./scrapers
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
  enrich-and-upsert:
    needs: scrape
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
        working-directory: ./scrapers
      - run: node enrich.js
        working-directory: ./scrapers
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Matrix parallelization runs each source's scrape as an independent job; the enrichment/upsert step runs once afterward on the combined output. This structure adds new sources without touching the enrichment logic, and adding AI enrichment without touching the per-source scraping logic — the two concerns stay decoupled.

---

## 6. Interest-Based Filtering (Matching Engine)

**Option 1 — Client-side filtering (beta):**

```javascript
const surfaced = allEvents.filter(event =>
  event.tags.some(tag => user.interests.includes(tag))
);
```

**Option 2 — Supabase RPC (more scalable):** a Postgres function taking a user ID, joining their interests, returning matching events sorted by date.

Both options depend on tags being drawn from the fixed taxonomy in Section 4 — this is the point where AI-generated tag drift would surface as broken filtering if the enum validation step were skipped.

---

## 7. Frontend Integration in StudentLink

### Step 1: Fetching Data
Fetch upcoming events in `StudentProvider` or via a new `useEvents` hook, same pattern as existing profile-detail fetching.

### Step 2: Dashboard (`app/(tabs)/index.tsx`)
- Replace `persona.surfaced` (mock data) with the live surfaced state.
- UI mapping: write a helper assigning `emoji`, `accent`, `tag`, `title`, `meta` from event data (e.g., `tags.includes('Social') → { emoji: '🍕', accent: 'amber' }`).
- Limit to events with `start_time` in the current week.

### Step 3: Events Page (`app/(tabs)/events.tsx`)
- Wire "View all" to `router.push('/(tabs)/events')`.
- Build a `FlatList`/`ScrollView` of all upcoming events, with a segmented control: "For You" | "All Events".

---

## 8. Handling Failures Gracefully in the App

- Upsert-only writes mean a scraper or AI failure leaves the DB with slightly stale (not broken or empty) data.
- If `allEvents.length === 0`, hide the "Surfaced for You" section or show an empty state:

```jsx
<View style={styles.emptyState}>
   <Text>No upcoming events right now. Check back later!</Text>
</View>
```

- This should also account for the AI enrichment fallback path: an event that fell back to keyword tagging is still a valid, displayable event — it should never be dropped just because AI enrichment didn't run successfully for it.

---

## 9. Explicitly Out of Scope for B6

- **Image recognition** (e.g., parsing a class schedule photo for M4) is not part of this milestone and is not being built now. It's noted here only because the AI provider decision above (OpenAI) was made with awareness that vision tasks may come later, so the choice doesn't need to be revisited purely on provider-count grounds if/when that work starts. Model selection for that task (accuracy, actual token cost per image, OCR-first-vs-direct-vision approach) is a separate decision to be made empirically, against real sample images, when that milestone is actually scoped — not assumed from today's text-task pricing.
- **Server/self-hosted scraping infrastructure** — not adopted. Revisit only if `scrape_runs` data shows GitHub Actions' time or rate-limit ceilings are actually being approached.

---

## Summary Checklist

- [ ] Create `events` and `scrape_runs` tables in Supabase.
- [ ] Initialize scrapers project with source registry pattern (`EventSource` interface).
- [ ] Build NorQuest module (API investigation → cheerio fallback).
- [ ] Build SANQC module (RSS investigation → cheerio fallback).
- [ ] Write normalizer (per-source `normalize()` implementations).
- [ ] Write AI enrichment step: batched tagging (fixed taxonomy) + normalization assist + pre-filtered dedup + summarization, with schema validation and keyword-matcher fallback.
- [ ] Write Supabase upsert script (never wipe, always upsert).
- [ ] Deploy GitHub Actions workflow with matrix strategy across sources + separate enrichment job.
- [ ] Add `OPENAI_API_KEY` as a repo secret.
- [ ] Build `useEvents` fetcher in React Native.
- [ ] Wire filtered data into `app/(tabs)/index.tsx`, replacing `persona.surfaced`.
- [ ] Build out `app/(tabs)/events.tsx` list view with "For You" / "All Events" toggle.
- [ ] Add empty-state handling for zero-events and AI-enrichment-fallback cases.
