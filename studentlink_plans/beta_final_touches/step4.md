# Step 4: Nickname / Name Selection (`app/(auth)/onboarding.tsx` - Step 2)

## Current State Analysis
This step asks users, "What should we call you?". It captures the user's name or nickname which acts as their display name across the app. If the user leaves it blank, it attempts to use the prefix of their email address as a fallback.

## Identified Issues & Areas for Improvement

### 1. Overly Aggressive Input Filtering
- **No Special Characters Allowed:** The `onChangeText` handler uses `name.replace(/[^a-zA-Z0-9\s]/g, "")`. This completely strips out valid name characters like apostrophes (e.g., O'Connor), hyphens (e.g., Jean-Luc), and accented characters (e.g., René). 
  - *Improvement:* Relax the regex to allow hyphens, apostrophes, and unicode letters (`\p{L}`), or remove the aggressive keystroke filtering entirely and only validate on submit.

### 2. Unpredictable Fallback Behavior
- **Email Prefix Fallback:** If a user skips entering a name, the app extracts the part of their email before the `@` symbol, cleans it, and uses it as their display name. For college students, emails often contain student ID numbers or last names, which they might not want exposed as their primary display name.
  - *Improvement:* Either make the Nickname field strictly required (disabling the "Next" button until they enter at least 2 characters) or explicitly show them what their auto-generated name will be before they submit it.

### 3. UI/UX & Polish
- **Silent Input Deletion:** Because of the regex mentioned above, if a user types a hyphen, it just silently disappears. This is frustrating UX.
  - *Improvement:* If we keep validation, it should show an inline message (e.g., "Only letters are allowed") rather than silently mutating user input.
- **"Skip For Now" button state:** The button text says "Skip For Now" if the input is empty. Given the fallback behavior, it might be better to force them to pick a name.

## Proposed Action Items (Checklist)
- [ ] Update the regex in `onChangeText` to support hyphens, apostrophes, and accented characters.
- [ ] Decide whether to keep the email fallback or make the Nickname field strictly required (Recommended: Make it required to protect user privacy).
- [ ] Remove silent keystroke deletion in favor of form validation on submit (or inline error text).
