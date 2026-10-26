# StudentLink App — Full Development Roadmap

## Purpose & Directive

This document is the authoritative technical and operational roadmap for building and launching **StudentLink**, a mobile application for university students. It is intended to guide a development team (or an LLM acting as a development assistant) through every phase of the project — from environment setup to post-launch operations.

---

## Development Phases

### Current Progress — 2026-06-18

Phase 2 Core logic refined with high-performance architecture.

Completed:

- **Zero-Lag Architecture:** Implemented global pre-fetching and caching via `StudentProvider`.
- **Hybrid Search Engine:** Preloaded majors and popular courses for instant autocomplete search.
- **Centralized Account Hub:** Migrated profile settings from a modal to a full-screen Tab experience.
- **Interests Integration:** Fully functional multi-select interest tagging in onboarding and the centralized Profile hub with Supabase DB synchronization.
- **UX Refinements:**
    - Stationary "Next" button in onboarding (140px safe-padding).
    - Stationary centered dialog pattern for profile edits.
    - Full Safe Area integration (Notch/Home indicator protection).
    - Universal scrollability for all lists and suggestions.
- **Data Guardrails:** Enforced 7-course enrollment limit and strict Regex course validation.
- **Optimistic UI:** Instant feedback for adding/removing courses and profile updates.
- **Security:** Implemented 2-step Sign Out verification.

---

### Phase 2 — Core Development (Refined)
Build steps must be followed in order — each depends on the previous.

**Step 1: Navigation Structure (Completed)**
- Set up Expo Router (file-based routing)
- Establish tab navigation and stack navigation

**Step 2: Supabase Initialization (Completed)**
- Setup Supabase Project and retrieve API keys
- Initialize `@supabase/supabase-js` with `AsyncStorage`
- Create core tables: `students`, `majors`, `courses`, `student_courses`

**Step 3: Profile Persistence & Routing (Completed)**
- Implemented `students` profile creation and updates
- Developed smart routing logic (existing profile check)
- Refactored Home dashboard to pull dynamic Supabase records

**Step 4: Advanced Profile & UX (Completed)**
- Developed a high-performance, zero-lag Profile Hub.
- Implemented Optimistic updates and global state synchronization.
- Applied mobile-first UX fixes (Keyboard handling, Safe Areas, stationary elements).

**Step 5: Content Discovery & Messaging (Next)**
- Integrate university and club newsletter content via RSS feed aggregation
- Store content in Supabase; display as a personalized, interest-filtered feed
- Implement direct messaging (DMs) using Supabase Realtime (WebSocket)

---

## Timeline Summary

| Phase | Duration | Key Deliverable |
|---|---|---|
| Phase 1: Environment Setup | Week 1 | Accounts active; app running on physical device |
| Phase 2: Core Development | Weeks 2-8 | Fully functional app with all MVP features |
| Phase 3: Production Preparation | Weeks 9-10 | Production builds complete; internal testing done |
| Phase 4: App Store Submission | Weeks 11-12 | App live on iOS App Store and Google Play |
| Phase 5: Post-Launch | Ongoing | Monitoring, OTA updates, iteration |
