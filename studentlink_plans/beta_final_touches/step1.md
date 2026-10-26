# Step 1: Welcome Page (`app/(auth)/index.tsx`)

## Current State Analysis
The Welcome page serves as the entry point to the application where users provide their email. It handles both sign-in and sign-up flows via Supabase, with an option to bypass OTP for testing.

## Identified Issues & Areas for Improvement

### 1. Security & Architecture
- **Hardcoded Auth Bypass:** `const BYPASS_AUTH = true;` is currently hardcoded in the file. This must be removed or strictly tied to a development environment variable (`__DEV__` or `.env`) before the beta launch to prevent unauthorized bypasses in production.

### 2. Validation & Error Handling
- **Basic Email Validation:** The email check only looks for the presence of an `@` symbol (`!emailLower.includes("@")`). 
  - *Improvement:* Implement a proper Regex-based email validation. Additionally, if the app is strictly for college students, we should consider restricting or at least warning if the email does not end in `.edu`.
- **Intrusive Alerts:** Invalid emails trigger a standard system `alert()`, which provides a poor user experience.
  - *Improvement:* Replace `alert()` with an inline error message text below the email input field (e.g., using a red error color).

### 3. UI/UX & Polish
- **Lack of Legal Links:** Most onboarding screens require users to acknowledge terms before proceeding.
  - *Improvement:* Add "By continuing, you agree to our Terms of Service and Privacy Policy" with clickable links below the Continue button.
- **Generic Logo:** The logo is currently a placeholder 'S' inside a colored box. 
  - *Improvement:* Replace with the actual StudentLink logo (SVG/PNG) for a more premium feel.
- **Button Copy:** The button says "Next". Since the real flow involves sending an OTP, changing the text to "Continue" or "Send Login Code" would be more descriptive once bypass is removed.
- **Keyboard Handling:** The `KeyboardAvoidingView` uses `padding` for iOS and `height` for Android. We should verify on physical devices that the layout doesn't break or hide the input on smaller Android screens.

## Proposed Action Items (Checklist)
- [ ] Remove or safeguard `BYPASS_AUTH` flag using environment variables.
- [ ] Implement robust Regex email validation.
- [ ] Add inline error text state (remove `alert()`).
- [ ] Add Terms of Service and Privacy Policy text/links.
- [ ] Replace placeholder "S" logo with final app logo.
- [ ] Update button text to reflect the OTP action (e.g., "Send Login Code").
