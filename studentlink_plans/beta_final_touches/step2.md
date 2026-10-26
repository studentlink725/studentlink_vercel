# Step 2: Email Verification (`app/(auth)/verify.tsx`)

## Current State Analysis
This page handles the 6-digit One-Time Password (OTP) verification after the user inputs their email. It uses Supabase Auth and attempts a cascade of verification types (`email`, `signup`, `login`) to ensure it works whether the user is new or returning.

## Identified Issues & Areas for Improvement

### 1. Missing Core Functionality
- **No "Resend Code" Button:** There is currently no way for the user to request a new OTP if they didn't receive the first one or if it expired. This is a critical flow blocker.
  - *Improvement:* Add a "Resend Code" button, ideally with a countdown timer (e.g., 60 seconds) to prevent spamming the auth provider.

### 2. Validation & Error Handling
- **Intrusive Alerts:** Just like Step 1, invalid codes or verification failures trigger a system `alert()`. 
  - *Improvement:* Replace `alert()` with inline error messages (e.g., "Invalid code, please try again") below the input field for a seamless experience.

### 3. UI/UX & Polish
- **Code Input UI:** Currently, the 6-digit code relies on a single `<TextInput>` with large `letterSpacing`. While functional, it feels basic.
  - *Improvement:* Consider using a dedicated OTP input component (where each digit has its own visual box) for a more modern and premium feel.
- **Generic Logo:** Still using the placeholder 'S'.
  - *Improvement:* Swap this out for the real app logo to maintain brand consistency across onboarding screens.
- **Auto-Submit on Completion:** Right now, the user types 6 digits and has to manually press "Verify".
  - *Improvement:* The form should automatically submit once the 6th digit is entered, saving the user a tap.

## Proposed Action Items (Checklist)
- [ ] Implement a "Resend Code" function with a cooldown timer.
- [ ] Replace `alert()` with an inline error state for invalid/expired codes.
- [ ] Update the single `TextInput` to a 6-box OTP input (or at least auto-submit on the 6th digit).
- [ ] Replace placeholder "S" logo with the official app logo.
