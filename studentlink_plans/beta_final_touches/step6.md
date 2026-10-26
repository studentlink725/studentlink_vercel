# Step 6: Class Input & Schedule Upload (`app/(auth)/onboarding.tsx` - Step 4)

## Current State Analysis
This step asks the user to upload a screenshot or photo of their weekly timetable. It features an "AI Parsing Coming Soon" banner. The uploaded image is converted to base64 and saved directly to the student's profile.

## Identified Issues & Areas for Improvement

### 1. Critical Architecture Flaw (Database Bloat)
- **Base64 in Database:** The image is converted to a base64 string and updated directly into the `students` table (`schedule_image` column). Image strings can easily exceed 5MB+. Storing this in a standard PostgreSQL row will cause massive database bloat, slowing down all queries involving the `students` table.
  - *Improvement:* This MUST be changed to upload the image to **Supabase Storage** (an S3 bucket) and only store the returned URL string in the `students` table.

### 2. Missing Core Functionality (No Class Matching)
- **Bypassed Manual Input:** The code for manual course input (`addCourse`, `removeCourse`, `validateCourseFormat`) exists in the file, but it was completely removed from the UI in favor of the image upload and the "AI parsing coming soon" banner.
- **The Consequence:** Because there is no manual input and no AI parsing yet, the app has **zero structured data** on what classes a student is actually taking. This means any backend feature designed to match students by shared classes will be completely broken in the beta.
  - *Improvement:* Reintroduce a simplified manual class input UI (e.g., "Enter up to 5 class codes") alongside the image upload so the beta actually has data to match students with.

### 3. Error Handling
- **Silent Failures:** If the Supabase upload fails (`if (error) console.error(...)`), the user is not notified. The UI just proceeds as if it worked.
  - *Improvement:* Show an alert or toast message if the image fails to save.

## Proposed Action Items (Checklist)
- [ ] **CRITICAL:** Refactor image upload to use Supabase Storage instead of saving base64 directly to the database row.
- [ ] Restore manual class code input (UI) so the app can build database associations (`courses` / `student_courses`) for beta matching algorithms.
- [ ] Add proper user-facing error handling if the upload fails.
