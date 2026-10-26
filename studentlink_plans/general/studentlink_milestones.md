# StudentLink Project Milestones & Progress Tracker

This document tracks the milestones and task lists for the StudentLink project, categorized by Beta Test requirements and MVP Phases.

---

## Part 1: Beta Test Scope

### [/] B1: Dev Infrastructure & Company Repos
> [!IMPORTANT]
> Everything else depends on this. Set it up correctly from day one — repo ownership and access control are legal requirements, not suggestions.

- [x] Create GitHub org owned by the company (not your personal account)
- [x] Configure dev and production environments
- [x] Setup the documentation of all systems and functionality which will be updated as the project progresses
- [x] Get CEO sign-off on hosting costs before committing to any paid infrastructure (if above the $200 limit)
- [ ] Get CEO to sign off on the software and infrastructure in use (in compliance with GNU GPL, AGPL, LGPL)

*Compliance Note:* SL-RRA-2026-005 3.6a: Code in personal accounts is a material breach. Do this right on day one.

---

### [/] B2: Integrate Lovable MVP & Live Backend
> [!NOTE]
> Replace the hardcoded example user with real authenticated data. This is the first working end-to-end version.

- [x] Wire login to home page — real name and profile data from the database
- [x] Implement OTP (passwordless) login via Supabase
- [ ] Enable "Confirm Email" in Supabase auth settings
- [x] Add persistent session so users stay logged in between app opens

---

### [x] B3: User Onboarding Flow
> [!NOTE]
> The full new-user experience from email verification through to interests selection.

- [x] Display Name input
- [x] Crowd-sourced major/program field — existing DB entries surface as the user types
- [x] Add student_interests table and build the interests selection screen

---

### [ ] B4: Interests-Based Matching
> [!IMPORTANT]
> The beta match engine uses interests only — no class parsing yet. Keep the algorithm simple and well documented.

- [ ] SQL query: overlap score based on shared interests
- [ ] Implement a way to verify the effectiveness of the matching engine scoring system. This will help refine it during the beta run
- [ ] Matches page UI — show match percentage and a "connect" button
- [ ] Privacy opt-in toggle in profile settings
- [ ] Document the algorithm clearly — must be comprehensible to a third party (SL-RRA-2026-005 3.2b)

---

### [ ] B5: Schedule Image Upload (Visual Only)
> [!NOTE]
> Users can upload a photo of their class schedule. For beta it's stored but not parsed — the AI processing comes later. Sets up the data pipeline and the UX pattern.

- [ ] Image upload UI on the classes screen
- [ ] Store uploaded images in Supabase storage with the user's account
- [ ] Display the uploaded image back to the user as confirmation
- [ ] Show a clear "coming soon" state for the auto-fill functionality
- [ ] No AI processing in beta — image is visual only

---

### [ ] B6: “Surfaced for You”
> [!NOTE]
> Automated event and news aggregation from NorQuest and SANQC sources, surfaced on the home page based on the user's interests. For beta, scraping and APIs replace manual curation.

- [ ] Request API access to norquest.ca/myquest — if granted, integrate the events feed directly. If MyQuest API access is not granted, build a web scraper for norquest.ca/myquest as a fallback
- [ ] Build a scraper for sanqc.ca to pull events and announcements. Evaluate whether sanqc.ca has an API or RSS feed before scraping — use that first if available
- [ ] Normalize scraped and API data into a shared event schema stored in the database
- [ ] Schedule scrapers to run on a regular interval (e.g. daily) so content stays current
- [ ] Filter or rank surfaced events based on the user's selected interests
- [ ] Show "this week" events on the home page with a "view all" link to the full Events page
- [ ] Handle scraper failures gracefully — stale or missing data should not crash the feed

---

### [ ] B7: Resource Hub
> [!NOTE]
> A curated list of campus resources that routes users to the right place via link.

- [ ] Manually curate links to NorQuest and SANQC resources — academic support, counselling, financial aid, student association, etc.
- [ ] Build a static resource hub page with categorized links (e.g. academic, wellness, campus life, financial)
- [ ] Each entry links directly to the appropriate university page — no scraping, no aggregation
- [ ] Keep it simple — a clean list or card layout the user can browse and tap through

---

### [/] B8: UX Fixes & Beta-Ready Polish
> [!WARNING]
> Small issues erode trust with first-time users. Fix the known ones before handing this to testers.

- [ ] Fix keyboard behavior — should stay visible during class/major input
- [ ] Fix Profile Settings — tapping outside the box should close it like the X does (migrated to full-page tab)
- [ ] Fix Add button timing on class input — only show after DB check completes
- [ ] Preload top 100 classes after email verification to eliminate selection lag
- [ ] Add profanity blacklist to Display Name, Major, and Course fields

---

### [ ] B9: Security Baseline & Compliance Check
> [!IMPORTANT]
> Even for a beta test with real student data, basic security controls are non-negotiable — especially with PIPA and PIPEDA in scope.

- [ ] Set up Supabase project with RLS policies on all tables
- [ ] Verify encryption at rest and in transit on all student data
- [ ] Confirm RLS policies are active on every Supabase table — no exceptions
- [ ] Review OWASP Top 10 basics — input validation, auth hardening
- [ ] Write a basic incident response protocol before any users are onboarded
- [ ] Confirm what data is being collected and that it matches what users are told

---

### [ ] B10: Basic 1-on-1 Messaging (Optional)
> [!NOTE]
> A DM opens when two users both hit "connect." Powered by Supabase Realtime.

- [ ] Mutual connect triggers a DM thread
- [ ] Supabase Realtime for live message delivery
- [ ] Message list screen
- [ ] In-app notifications — new match, new message
- [ ] Badge count on nav icons
