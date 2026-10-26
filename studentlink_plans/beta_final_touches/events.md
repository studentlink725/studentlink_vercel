# Events Page (`app/(tabs)/events.tsx`)

## Current State Analysis
This tab displays a list of upcoming events. Users can toggle between "My Interests" (events matching their tags) and "All Events", filter by category, and click RSVP on events.

## Identified Issues & Areas for Improvement

### 1. Fake/Broken RSVP System
- **Local State Only:** When a user clicks the "RSVP" button, it only updates a local React `Set`. It **never** saves the RSVP to the Supabase database. If the user switches tabs and comes back, all their RSVPs are lost.
  - *Improvement:* Connect the RSVP button to an `event_attendees` table in Supabase so RSVPs persist, and use this data to display the real number of people attending instead of a hardcoded `0`.
- **Button Text:** Change the initial button text from "RSVP" to "I'm Going", which will toggle to a green "Going" state when clicked.
- **Wrong Key Used:** The RSVP set uses `item.title` instead of `item.id`. If two events share a title, clicking RSVP on one will highlight both.

### 2. Event Search Missing
- **No Search Bar:** There is currently no way to search for a specific event by name or keyword.
  - *Improvement:* Add a search bar to the events tab.

### 3. Default Filter Logic & Invalid JSON Bug
- **Empty Interests Fallback:** If a user has no interests selected, or if there are zero events matching their interests, the page currently still defaults to "My Interests" and shows an empty screen.
  - *Improvement:* Add logic to default to "All Events" if the user has no interests or if their tailored event list is empty.
- **JSON Error:** There is a bug causing an "invalid JSON" error on the events tab if a user has zero interests. This parsing error needs to be caught and handled gracefully.

### 4. Client-Side Filtering Bug (Pagination Failure)
- **The Limit 100 Bug:** The page fetches events using `.limit(100)` and then filters them in JavaScript for the "My Interests" tab. If the database has 200 events, and the user's matched events happen to be items 101-150, their "My Interests" list will be completely empty!
  - *Improvement:* Move the "My Interests" filtering to the database query itself (using `.overlaps()` or `.contains()`) rather than doing it in JavaScript. 
- **No Infinite Scroll:** There is no pagination implemented. Once the app exceeds 100 events, the rest are permanently inaccessible.

### 5. Multi-Tenant Failures
- **Hardcoded School Name:** The intro text explicitly says "Discover what's happening at NorQuest and SANQC". The fallback location for an event is also hardcoded to "NorQuest / SANQC". Non-NorQuest students will be very confused.
  - *Improvement:* Use `studentData.school` to dynamically inject the correct institution name into the subheading and fallbacks.

## Proposed Action Items (Checklist)
- [ ] Implement real database saving for RSVPs to track attendance counts.
- [ ] Change the "RSVP" button text to "I'm Going" and fix the state to track `item.id`.
- [ ] Add a search bar for events.
- [ ] Fix the invalid JSON bug when a user has no interests.
- [ ] Change the default filter to "All Events" if the user has no interests or no tailored events.
- [ ] Rewrite the Supabase query to filter "My Interests" on the backend to avoid the `limit(100)` bug.
- [ ] Implement pagination (infinite scroll) for the FlatList.
- [ ] Remove hardcoded "NorQuest" references and replace them with dynamic school names.
