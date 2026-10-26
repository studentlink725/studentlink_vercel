# Step 5: Major & Year Selection (`app/(auth)/onboarding.tsx` - Step 3)

## Current State Analysis
This step asks for the student's major (with autocomplete suggestions pulled from the database) and their year of study (1 through 5+). It updates the `students` and `majors` tables in Supabase.

## Identified Issues & Areas for Improvement

### 1. Text Input & Formatting
- **Aggressive Input Filtering:** Similar to the Nickname step, the major input filters out all special characters (`/[^a-zA-Z0-9\s]/g`). This prevents valid major names like "Pre-Med", "Arts & Science", or "IT/Business".
  - *Improvement:* Relax the regex to allow hyphens, ampersands, and slashes.
- **Flawed Acronym Formatting:** The app automatically forces `toTitleCase()` on the major before saving. The custom function (`toLowerCase()` followed by capitalizing the first letter) will butcher acronyms. "IT" becomes "It", "BSc" becomes "Bsc", etc.
  - *Improvement:* Either remove the forced `toTitleCase()` and trust user casing, or use a more intelligent casing library that respects acronyms.

### 2. UI/UX Bugs
- **Nested ScrollViews:** The autocomplete dropdown for Major suggestions uses a `<ScrollView>` embedded inside the main page `<ScrollView>`. This is a known anti-pattern in React Native and often leads to broken scrolling behavior (especially on Android).
  - *Improvement:* Refactor the suggestion list to use an absolute-positioned dropdown menu, or replace the main scroll view with a `KeyboardAwareScrollView` that doesn't conflict with a `FlatList` for the suggestions.

### 3. Business Logic
- **Allowing Skips:** The "Next" button turns into "Skip For Now" if the user hasn't filled out both Major and Year. Since StudentLink likely relies heavily on matching students by major and year, allowing them to skip this core demographic data might hurt the user experience later on.
  - *Improvement:* Consider making Major and Year required fields for onboarding.

## Proposed Action Items (Checklist)
- [ ] Relax regex on the Major input to allow common punctuation (`&`, `-`, `/`).
- [ ] Fix or remove the custom `toTitleCase` function so acronyms (e.g., "IT") are not ruined.
- [ ] Fix the nested ScrollView issue for the Major autocomplete list.
- [ ] Decide whether to enforce Major/Year as required fields (Recommended: Yes).
