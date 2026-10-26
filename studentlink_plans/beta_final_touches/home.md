# Home Page Dashboard (`app/(tabs)/index.tsx`)

## Current State Analysis
The home page acts as the main dashboard for the user. It greets them, shows a recommended event, shows their top peer match, and provides links to the Resource Hub.

## Identified Issues & Areas for Improvement

### 1. Multi-Tenant Failure (Hardcoded School Data)
- **NorQuest Hardcoding:** The Resource Hub section title was explicitly "NorQuest Resource Hub", and the 4 resource categories are hardcoded. If a user from a different school (e.g., University of Alberta) uses the app, they will still see NorQuest's resources.
  - *Improvement Made:* Made the Resource Hub title dynamic based on `studentData.school`.
  - *Pending Action:* The resource categories are still hardcoded. We must create a Supabase database schema (`school_resources`) and fetch them dynamically based on the user's school.

### 2. Placeholder Content in Production (Proactive Signal Card)
- **Demo Alert Card:** There was a large black card labeled "PROACTIVE SIGNAL (DEMO)" with hardcoded data.
  - *Improvement Made:* We removed this card entirely for the beta, as building a backend to support real proactive notifications is out of scope for the beta launch.

### 3. Severe Performance Flaw (Client-Side Filtering)
- **Fetching ALL Events:** To find the "Best Event", the app runs `supabase.from("events").select("*")` without any limits, fetching the entire events table to the client device, and then runs a javascript `.find()` loop to match tags. As the app scales, this will cause massive memory spikes and slow load times.
  - *Improvement:* Move this logic to a Postgres RPC function or at least use `.contains()` or `.overlaps()` on the Supabase query to filter events on the database side before returning them.

### 4. Broken UI State
- **"0 Classes" Bug:** The header says "You're enrolled in X classes". Because the manual class input was bypassed in onboarding (noted in `step6.md`), this will say "0 classes" for almost every user, making the app look broken.
  - *Improvement:* Either reintroduce class input during onboarding, or conditionally hide the class count text if it is 0.

### 5. Empty States
- **Hidden Sections:** Previously, if no matching peer or event was found, the sections silently disappeared.
  - *Improvement Made:* Implemented styled empty state cards. Now, if `bestEvent` or `topPeer` are null, the app displays a card prompting the user to add more interests or wait for more peers to join, keeping the UI layout consistent.

## Proposed Action Items (Checklist)
- [x] Remove the hardcoded "Demo" proactive alert card.
- [x] Make the Resource Hub title dynamic based on the user's school.
- [ ] Migrate the hardcoded resource categories to the database so they filter by school.
- [ ] Refactor the event fetching logic to filter on the database side instead of fetching `*`.
- [ ] Fix the "0 classes" text issue.
- [x] Add empty states for the Top Peer and Surfaced Event sections.
