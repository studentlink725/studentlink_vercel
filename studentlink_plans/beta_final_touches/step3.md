# Step 3: School Selection (`app/(auth)/onboarding.tsx` - Step 1)

## Current State Analysis
This step asks users to select their institution. Currently, there are three hardcoded institutions, with only one ("NorQuest College") set as active. It uses a clean, selectable list UI.

## Identified Issues & Areas for Improvement

### 1. Data Hardcoding
- **Hardcoded School List:** The `INSTITUTIONS` array is hardcoded directly into the component.
  - *Improvement:* Fetch the list of active/inactive schools from the Supabase database. This allows admins to activate new schools without pushing an app store update.

### 2. Missing UX Automation
- **Unused Domain Mapping:** There is a `DOMAIN_TO_SCHOOL` constant in the code mapping email domains (e.g., `ualberta.ca`) to schools. However, this is never actually used!
  - *Improvement:* Extract the domain from the user's email (`userEmail.split('@')[1]`), check `DOMAIN_TO_SCHOOL` (or the DB), and **auto-select** the correct school for them to save a click. 

### 3. Scalability & Edge Cases
- **No Search Bar:** If the list of supported schools grows beyond 5-10, scrolling will become tedious.
  - *Improvement:* Add a simple search/filter bar at the top of the list if the number of schools exceeds a certain threshold.
- **Unsupported Schools:** Users whose school isn't listed just see the 3 options and might bounce.
  - *Improvement:* Add a "Don't see your school? Request it here" button at the bottom of the list that logs interest or opens a simple feedback form.

## Proposed Action Items (Checklist)
- [ ] Implement email domain parsing to auto-select the user's school based on their email.
- [ ] Move the `INSTITUTIONS` list out of hardcoded state and fetch it from a Supabase table.
- [ ] Add a "Request a School" button/link for unsupported users.
- [ ] (Optional for Beta) Add a search bar to filter the school list.
