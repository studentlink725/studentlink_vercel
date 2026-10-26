# Resources Page (`app/(tabs)/resources.tsx`)

## Current State Analysis
This page acts as a hub for student services, offering categorized links to academic support, financial aid, mental health, and more. It includes a search bar, a "Recommended for you" card, and a grid of categories.

## Identified Issues & Areas for Improvement

### 1. Multi-Tenant Failure & Maintenance Nightmare
- **Hardcoded Links:** Every single resource link, title, and organization is hardcoded directly into the `RESOURCE_CATEGORIES` constant in the frontend code. They are 100% specific to "NorQuest" and "SANQC".
- **The Consequence:** If a user from another university signs in, this page will still show them NorQuest links, making it entirely useless. Additionally, university websites change URLs frequently; having these hardcoded means every broken link requires pushing a new app update to the App Store.
  - *Improvement:* Move all resource links to a `school_resources` table in Supabase. The app should fetch this data dynamically based on `studentData.school`.

### 2. Fake Features (Placeholder Content)
- **"Recommended for you" Card:** There is a card that says "Academic Coaching Drop-In" with the subtext "Suggested based on your midterm conflict". The link it opens is entirely hardcoded.
  - *Improvement:* This is clearly a mockup left in the production code. It should be removed, or the app needs a real backend mechanism to generate context-aware recommendations (e.g., if a user searches for "math help" frequently, recommend tutoring).

### 3. Search Scalability
- **Client-Side Search:** The search bar filters through the hardcoded array in JavaScript. While this works for 20 links, if the app fetches hundreds of campus resources from a database later, this will become slow.
  - *Improvement (Optional for Beta):* If migrating resources to the database, consider wiring the search bar up to a Postgres full-text search query instead of doing it on the client.

## Proposed Action Items (Checklist)
- [ ] **CRITICAL:** Migrate the hardcoded `RESOURCE_CATEGORIES` to a Supabase table (`school_resources`).
- [ ] Update the page to fetch resources dynamically based on the current user's school.
- [ ] Change the hardcoded subtitle ("Support services at NorQuest") to use `studentData.school`.
- [ ] Remove or implement the fake "Recommended for you" card.
