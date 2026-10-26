# Profile Page (`app/(tabs)/profile.tsx`)

## Current State Analysis
The profile page allows the user to edit their name, year, major, courses, schedule image, and interests. It also controls the "Discovery Mode" toggle for peer matching.

## Identified Issues & Areas for Improvement

### 1. The Base64 Image Storage Bug
- **Database Bloat:** When a user uploads a schedule image, the app converts the image to a Base64 string and saves it directly into the `schedule_image` column of the `students` table. 
- **The Consequence:** This is disastrous for performance. High-resolution images converted to Base64 can be several megabytes in size. Every query that pulls a user's profile will be downloading megabytes of text data, slowing the app to a crawl.
  - *Improvement:* Move image storage to a Supabase Storage Bucket. The `students` table should only store the URL path to the image, not the image data itself.

### 2. Flawed "Optimistic UI" Implementation
- **Silent Failures:** When saving profile updates (like Major or Interests), the app uses an optimistic UI approach: it instantly updates the local React context and closes the edit screen, then runs the Supabase database save in the background. 
- **The Consequence:** If the background database save fails (e.g., no internet connection), it just logs an error to the console. The user is completely unaware that their save failed. The screen shows their new major, but if they restart the app, it will revert.
  - *Improvement:* If the background sync fails, the app must catch the error, roll back the local context to its previous state, and show an `Alert` to the user explaining that the save failed.

### 3. Mockup UI in Production
- **AI Concierge Banner:** In the "Manage Courses" view, there is a large banner advertising an upcoming "AI Parsing" feature to auto-fill schedules from the uploaded image. 
  - *Improvement:* If this feature is not launching in the beta, this banner should be removed or hidden behind a feature flag, as it takes up significant space and offers no functionality.

## Proposed Action Items (Checklist)
- [ ] **CRITICAL:** Refactor schedule image uploads to use a Supabase Storage Bucket instead of saving Base64 strings to the database row.
- [ ] Implement error handling and state rollbacks for all optimistic UI updates (`saveProfileUpdate`, `saveMajor`, `saveInterests`, etc.).
- [ ] Remove the "AI Parsing - Coming Soon" placeholder banner.
- [ ] Review the hardcoded 7-course limit to ensure it's appropriate for all schools.
