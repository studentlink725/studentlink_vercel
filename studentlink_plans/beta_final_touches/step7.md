# Step 7: Interests Selection (`app/(auth)/onboarding.tsx` - Step 5)

## Current State Analysis
This is the final step of onboarding. It presents a list of interests grouped by category, fetched from the `allInterests` context. Upon completion, it navigates the user to the main app dashboard and saves their selections to the database in the background.

## Identified Issues & Areas for Improvement

### 1. Inconsistent Validation
- **Missing Requirement Check:** The UI subtitle explicitly tells the user to "Select at least one to help us match you." However, there is no validation to enforce this. A user can click "Complete Signup" without selecting any interests.
  - *Improvement:* Disable the "Complete Signup" button until `formData.interests.length > 0`.

### 2. Fragile Data Parsing
- **String Split Dependency:** The app groups interests into categories by splitting the database string on `": "` (e.g., `"Sports: Basketball"`). If an admin adds an interest to the database without this exact formatting (e.g., just `"Basketball"`), it breaks the categorization and creates a category named "Basketball".
  - *Improvement:* Make the parsing more robust, or ideally, change the database schema so that `category` is its own distinct column in the `interests` table rather than relying on string manipulation.

### 3. Error Handling in Background Saves
- **Fire-and-Forget Save:** When the user finishes, the app instantly navigates to the dashboard and runs `saveInterestsOnboarding()` asynchronously. If the database insert fails (e.g., network drop), the error is only logged to the console. The user has no idea their interests weren't saved.
  - *Improvement:* Implement a global toast/notification system that alerts the user if the background save fails, or just `await` the save with a loading spinner before navigating.

## Proposed Action Items (Checklist)
- [ ] Enforce the "Select at least one" rule by disabling the continue button if no interests are selected.
- [ ] Refactor the database or parsing logic so categories aren't strictly dependent on the `": "` string delimiter.
- [ ] Add user-facing error handling (like a toast notification) if the background save to `student_interests` fails.
