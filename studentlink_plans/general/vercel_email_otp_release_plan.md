# StudentLink Vercel MVP: Email OTP Release Plan

**Purpose:** a repo-specific, step-by-step runbook for turning on and releasing the existing passwordless email login flow for StudentLink on Vercel.

**Scope:** email one-time passcodes (OTP) sent and verified by Supabase Auth; the Expo Router web app hosted as a static export on Vercel; first-time profile onboarding and returning-user login. This document is a plan, not a claim that the live Supabase project has been inspected or changed.

## 1. Findings from this repository

- This is an Expo 54 / React Native Web app using Expo Router. `npm run build` runs `expo export --platform web`; `vercel.json` serves the generated `dist` output and rewrites requests to `/`. There is no custom Vercel API/server in this project.
- Supabase is the backend for authentication, Postgres data, and (elsewhere in the app) matching/events. The web client is initialized in `src/lib/supabase.ts` using `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The anon/publishable key is expected to be in browser code; a service-role/secret key must never be added to this app or any `EXPO_PUBLIC_` variable.
- `app/(auth)/index.tsx` already has a `signInWithOtp({ email, options: { shouldCreateUser: true } })` path and navigates to `app/(auth)/verify.tsx`. **That path is currently unreachable** because `BYPASS_AUTH = true` takes a hardcoded password sign-in/sign-up branch first. Removing that bypass is a release blocker.
- `app/(auth)/verify.tsx` calls `verifyOtp({ email, token, type: 'email' })`, then checks `students.id` for the authenticated user. Existing student goes to `/(tabs)`; no student goes to onboarding. The code sends the code and verifies it, but currently has no resend-code control, resend cooldown, robust handling for malformed route params, or error mapping for expired/rate-limited codes.
- `src/lib/supabase.ts` persists web auth sessions in `localStorage` (in-memory fallback) and enables `detectSessionInUrl`; `src/data/persona-context.tsx` listens to auth state changes and loads student state. `app/_layout.tsx` additionally checks session/profile and redirects to auth, onboarding, or tabs.
- `app/(auth)/onboarding.tsx` requires a valid authenticated user before saving profile data. Its first step upserts `students` with `id`, `school`, and `email`; later steps upsert the same row with name/major/year and save interests. Thus OTP must complete and establish a usable Supabase session before onboarding begins.
- The checked-in database dump at `studentlink_plans/beta_final_touches/database_analysis/schema.sql` shows `students.id` references `auth.users.id`; it shows own-row student select/insert/update policies. However, the associated analysis document explicitly says the dump does not prove live RLS is enabled and identifies potentially serious security-definer/RLS problems. A checked-in SQL dump is not proof of the current hosted project's state. Verify live policies before release; never weaken RLS to make login work.
- Existing project notes already mark “Enable Confirm Email” as outstanding (`studentlink_plans/general/studentlink_milestones.md`). The app's school mapping (`ualberta.ca`, `mymacewan.ca`, `norquest.ca`) is a convenience, not an enforced email eligibility rule. Decide the acceptable email policy before launch; OTP proves control of an email address, not student enrollment.
- `.env` is ignored by Git and was not read or copied into this plan. `.env.example` contains only placeholder public Supabase variables.

## 2. Target release behavior

1. User enters a normalized email address and requests a code.
2. Supabase Auth sends a six-digit OTP email. The email template must render `{{ .Token }}`; if the template renders only `{{ .ConfirmationURL }}`, the user gets a magic link instead of the code-entry experience.
3. User enters the code on the verify screen. Supabase validates it and creates/restores the session.
4. App verifies the authenticated user identity from the Supabase response/session, then checks for `students.id = auth user id`.
5. Existing profile routes to tabs; a new authenticated account routes to onboarding with verified email from `user.email` as the source of truth (route email is display/input context only).
6. Session survives refresh and browser restart where browser storage permits; sign out clears it. Protected data remains governed by database RLS.
7. Expired/wrong codes, resend cooldown, email delivery failure, offline/network errors, and rate limiting are presented clearly and allow a safe retry.

## 3. Decisions and prerequisites (record these before implementation)

- [ ] **Email eligibility:** any valid email, only approved school domains, or selected campuses? The current UI allows a free-form email and has mappings for three domains, while only NorQuest is active in onboarding. Do not assume `.edu`: Canadian institutions commonly use other domains. If restricting, maintain an explicit, reviewed allowlist and define what happens for missing/ambiguous domains.
- [ ] **Account creation:** current call uses `shouldCreateUser: true`, meaning unknown email addresses can be registered. Confirm that is desired and that “student” profile creation remains a separate onboarding action.
- [ ] **Production hostnames:** record the canonical Vercel production domain and any custom domain. Record which Vercel preview hosts are needed and who can access them. Do not use an unrestricted redirect wildcard in production.
- [ ] **Email sender and volume:** choose a supported SMTP sender and verified sending domain (recommended for release; Supabase built-in email is test-only/limited). Identify the mailbox/owner that receives delivery/bounce/abuse alerts.
- [ ] **OTP policy:** agree on expiration, resend cooldown, and user-facing limits based on the current Supabase dashboard values and expected user experience. Do not promise a timer that differs from Supabase's enforced limit.
- [ ] **Auth project separation:** identify the Supabase project used for development/staging and production. If only one project currently exists, decide whether to create a production project before real users are invited.
- [ ] **Privacy and support:** approve what the UI says about email use, terms/privacy links (not present in this login page), support contact, and account recovery/help when the student cannot access their mailbox.

## 4. Phase A — Capture the current hosted configuration

Do this read-only before changing settings. Use the Supabase Dashboard for the project actually referenced by the Vercel environment; do not paste credentials into source control or this file.

1. In Vercel, open the StudentLink project and record the Production domain, Git branch mapped to production, build command, output directory, and production environment variable names. Confirm the build settings align with `vercel.json` (`npm run build`, `dist`).
2. Identify the Supabase project from the project URL (project ref). Record project ref and environment purpose in a private deployment inventory, not secrets in Git.
3. In **Authentication → Sign In / Providers → Email**, verify email provider and email OTP are enabled. Record the **Confirm email** setting. For real launch users, keep email confirmation enabled so an email address is not treated as verified without OTP.
4. In **Authentication → URL Configuration**, record Site URL, redirect allowlist, OTP/email expiration, and any custom auth domain. Compare to actual intended production and local development URLs.
5. In **Authentication → Email Templates → Magic Link** (label can vary by dashboard version), inspect the exact template and variables. Record whether it sends `.Token`, `.ConfirmationURL`, or both. The desired OTP path uses `{{ .Token }}` and should tell users where/how to enter it.
6. In **Authentication → Rate Limits**, record the actual per-user resend window, verify limits, and email-provider sending quota. These values can change; use the live dashboard as the source of truth.
7. Inspect **Authentication → Users** and safely establish how existing beta accounts were created. Because the bypass branch used one shared hardcoded password, determine whether it created password-auth users, whether those accounts have confirmed emails, and whether OTP sign-in can access them. Do not mass-delete or reset accounts as part of this step.
8. Verify the live database state before any release: RLS enabled status on every app-facing public table, relevant policies, and any exposed `SECURITY DEFINER` functions. The checked-in `database_analysis.md` calls out unresolved concerns. Authenticated OTP does not fix an unsafe database policy.

**Deliverable:** a private environment/config record containing project refs, domains, settings, and an issue list. No secret keys or SMTP passwords in the repo.

## 5. Phase B — Configure Supabase Auth and email delivery

1. **Separate environments.** Prefer distinct Supabase projects for staging and production. Keep test users and mail settings in staging. If creating a new production project, migrate the needed schema/data deliberately and verify it rather than assuming the checked-in schema dump is current.
2. **Configure email provider.** Enable Email OTP. Keep confirmation/verification required in production. Do not disable confirmation to bypass email delivery problems.
3. **Configure sender domain and SMTP.** Select an email provider; verify its sender domain and publish the provider's required DNS records (commonly SPF and DKIM; add DMARC according to the domain policy). Set SMTP host, port, username, password, sender name, and sender address in Supabase Auth SMTP settings. Verify domain ownership and deliverability before involving users. Keep the SMTP password only in the provider/Supabase secret settings.
4. **Set an OTP-only template.** Update the Auth email template used by `signInWithOtp` to include the six-digit value `{{ .Token }}`, clear expiry instructions, the StudentLink name, and support details. Avoid depending on a confirmation link for this manual code-entry screen. Send test messages to Gmail, Outlook/Microsoft 365, and an institutional mailbox; check spam placement, mobile layout, sender/reply-to, code visibility, and that the code is not truncated.
5. **Set URL configuration.** Set the Supabase Site URL to the canonical HTTPS production origin. Add only needed redirect URLs:
   - Production origin and any exact auth callback/route used by the app.
   - Local web development origin (usually `http://localhost:8081/**` for Expo Web, confirm the port in use).
   - Staging origin.
   - Vercel preview pattern only if preview deployments need authentication; constrain it to the team's Vercel slug and test its exact matching. Remove stale/unknown redirect entries. Vercel's ephemeral preview URL is not itself a stable production URL.
6. **Avoid accidental link behavior.** The implementation uses code entry, so no `emailRedirectTo` is required for the basic OTP path. If later adding magic-link support, add the exact redirect URL to Supabase's allowlist and ensure template links use the expected redirect variable. Test separately from code OTP.
7. **Set the configured expiry and quotas.** Use the shortest practical OTP lifetime that supports students checking email; Supabase's current default documentation says one hour and a 60-second per-user send window, but verify the live project. The built-in email sender is restricted and low-volume (currently documented as two emails/hour and team-member recipients); production use for arbitrary student addresses requires custom SMTP or an approved Send Email hook. Set reasonable project limits only after SMTP is configured. Keep abuse controls enabled.
8. **Do not expose admin credentials.** Vercel's browser bundle may include only the Supabase URL and anon/publishable key. Never set the service-role key as `EXPO_PUBLIC_*`, in client code, or in static build output. There is no need for a Vercel serverless function for standard Supabase OTP.

## 6. Phase C — Implement and harden the client flow

Make changes on a feature branch and keep code scoped to auth unless tests reveal a necessary adjacent fix.

### C1. Request screen (`app/(auth)/index.tsx`)

1. Remove the `BYPASS_AUTH = true` branch and all hardcoded shared-password sign-in/sign-up code. Add a source review/search ensuring no bypass remains in a production branch.
2. Normalize email with `trim().toLowerCase()` and validate it sensibly before calling Supabase. Client validation is for UX only; Supabase remains authoritative. Don't add an institution-domain restriction until the eligibility decision is made and enforced consistently.
3. Keep `signInWithOtp({ email, options: { shouldCreateUser: true } })` if self-service registration is approved. If the product allows existing accounts only, change to `false` and provide an enrollment flow; do not change this unintentionally.
4. On success, navigate to verify with the normalized email and a safe resend timestamp/flow context. The success response has no session/user yet; do not route to onboarding until `verifyOtp` succeeds.
5. Disable duplicate sends while loading. Show a non-enumerating message such as “If this address can sign in, we’ll send a code” when product policy requires not revealing account existence. Map rate-limit and delivery errors to user-safe messages; log diagnostic error codes without logging the OTP or unnecessary personal data.
6. Replace platform `Alert` for this web path with visible, accessible inline status/error text. Support keyboard submit and appropriate autocomplete/autocapitalize behavior.

### C2. Verification screen (`app/(auth)/verify.tsx`)

1. Validate that the `email` route parameter exists and is a single string. If absent, return to email entry; never pass `undefined` into `verifyOtp`.
2. Normalize displayed/submitted email consistently. Use `user.email` from the verified Supabase response/session for identity and profile creation; a URL parameter can be edited and must not be trusted as account identity.
3. Accept exactly six digits (`^\\d{6}$`), retaining leading zeros. Continue to use `verifyOtp({ email, token, type: 'email' })` for codes issued by `signInWithOtp`. Avoid guessing among multiple token types; use the flow's documented type.
4. On verification success, ensure `data.user` exists and a session is established. Treat missing user/session as a recoverable error. Then query `students` by `data.user.id` and branch as the current screen does.
5. Add “Resend code” with a visible countdown based on the chosen resend window. Disable resend until cooldown ends and while request is active. Call `signInWithOtp` again with the same normalized email and `shouldCreateUser` policy. State clearly that a resend invalidates or supersedes the old code if that is the provider behavior; test it.
6. Handle invalid code, expired code, too many attempts, resend throttling, offline/network failures, and unknown errors. Let users correct code and retry without losing the email. Avoid exposing raw Supabase internals or stack traces.
7. Prevent stale submissions: disable verify and resend while a request is pending; ignore state updates after unmount if applicable. Consider auto-submit only after the interaction has been verified on web/mobile and ensure paste works.
8. Add accessible labels, numeric input mode, one-time-code autofill hints where supported, and visible focus/error states. The existing `TextInput` is acceptable for the first release if paste/autofill and six-digit constraints work reliably.

### C3. Session, routing, and onboarding integration

1. Exercise the route guard in `app/_layout.tsx` and auth state handling in `src/data/persona-context.tsx` after a fresh OTP session, returning session, expired session, and sign-out. A newly verified user has no student row and must remain able to reach onboarding.
2. Verify the `students` lookup behavior when no row exists. RLS should permit the authenticated user to read their own row, with zero rows treated as “new user,” not as auth failure. Database errors must remain distinguishable from zero rows.
3. Confirm onboarding only writes to the row matching `auth.uid()` and uses verified `user.email`; preserve required `school NOT NULL` and foreign-key relationship to `auth.users`.
4. Check the `(auth)` layout and Expo Router route resolution for `verify.tsx`; explicitly register the verify screen if required by the installed router configuration. Confirm refresh/deep-link route handling under the Vercel rewrite.
5. Test storage persistence in normal browser mode and private/restricted storage mode. The app's in-memory fallback means restricted storage can keep a session only for the current page lifetime; ensure the UI does not promise durable login in that case.
6. Test sign out from `app/(tabs)/profile.tsx`; verify it clears the Supabase session and the route guard sends the user to email login. Do not mistake local profile deletion for full Auth account deletion; this repo explicitly lacks server-side Auth user deletion.

### C4. Security and database checks

1. Review live RLS and grants for `students`, `student_courses`, `student_interests`, and any additional tables reached after login. Test as anon, authenticated user A, and authenticated user B: anon must not access private student records; A must not read/write B's private rows; authenticated reads of public catalog tables should follow intentional policy.
2. Inspect every RPC callable by the client, especially `SECURITY DEFINER` functions called with user IDs. Derive identity from `auth.uid()` inside privileged functions and restrict grants. Resolve the specific concerns documented in `studentlink_plans/beta_final_touches/database_analysis/database_analysis.md` before inviting real users.
3. Check Auth user creation/profile relationship and orphan states: a successful verified Auth user without a `students` row is expected until onboarding completes; a student row without a matching Auth user must not be possible through client paths.
4. Confirm the public anon key has only intended access through grants plus RLS. A public anon key is not a secret; RLS and function authorization are the security boundary.

## 7. Phase D — Vercel deployment setup

1. Confirm Vercel's Git project points to this `studentlink_vercel` repository/root directory. Keep the Expo export output as `dist`; retain the SPA rewrite only after confirming direct navigation and refresh work for `/(auth)/verify`, onboarding, and tab routes.
2. Add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to Vercel **Preview** and **Production** environments with the correct matching Supabase project values. These names are baked into the static client bundle at build time. Do not use staging credentials in Production or production credentials in public Preview builds unless that is an explicit policy.
3. Confirm no service-role key, SMTP credential, management API token, or personal access token exists in client environment variables or repository files. `.env` is ignored; keep it that way.
4. Redeploy after changing Vercel environment variables; existing deployments do not retroactively receive build-time variables. Inspect the build log for missing/empty Supabase config without printing secret values.
5. Use a staging Preview URL to test end-to-end only if its origin is on Supabase's allowlist. Keep preview auth tied to non-production data or disable it for untrusted public previews.
6. Verify production canonical URL and HTTPS custom-domain status before setting that origin as Supabase Site URL. Update redirect allowlists if domain changes.
7. Review the generated `dist` bundle or deployment output for accidental secrets. The URL and anon key are expected; service-role/SMTP secrets are not.

## 8. Phase E — Verification matrix (required before launch)

Run this against the staging Supabase project first, then a controlled production smoke test with designated test accounts. Record date, app commit/deployment URL, project ref, tester, result, and non-sensitive evidence.

| Scenario | Expected result |
|---|---|
| New email requests code | One email arrives with six-digit code; no session is assumed before verification. |
| Correct new-user code | Auth user becomes verified/session is established; no `students` row routes to onboarding; profile save succeeds under RLS. |
| Correct returning-user code | Session established; existing own profile routes to tabs; data loads. |
| Wrong code | Inline error; no profile access/session transition; corrected code can be retried within provider limits. |
| Expired code | Clear expired-code message; request/resend a new code and finish login. |
| Resend before cooldown | Button unavailable; no duplicate email request. |
| Resend after cooldown | New email arrives and the currently valid code behavior is understood; UI handles old code predictably. |
| Invalid/blank/missing email or route parameter | Client blocks invalid request or returns safely to email screen; no uncaught error. |
| Provider throttles send/verify | Friendly retry guidance; no resend loop or misleading success. |
| Unknown/non-eligible domain (if restricted) | Follows the approved policy and does not accidentally create a profile. |
| Network loss during send/verify | Recoverable error; user can retry without duplicate navigation or corrupted session state. |
| Refresh on verify, onboarding, tabs | Vercel serves app route; session/routing are coherent; user is not trapped in a redirect loop. |
| Browser restart | Session restores in supported storage conditions; otherwise login behavior is clear and safe. |
| Sign out | Session removed, private UI inaccessible, login screen shown. |
| User A vs user B / anon | Live RLS and RPC permissions block cross-user private reads/writes. |
| Email clients | Gmail, Outlook/M365, and institutional mailbox deliver readable, timely, untruncated code; check spam and link/code presentation. |
| Production deployment | Uses production Supabase project and production domain; no bypass or development credentials in bundle. |

## 9. Release gates and rollback

Release only when every gate is satisfied:

- [ ] Bypass and shared password removed; repository search and code review confirm no production path skips OTP.
- [ ] Email provider, sender-domain DNS, and OTP template tested successfully with non-team addresses.
- [ ] Confirm Email is enabled; expected expiry, resend cooldown, and rate limits recorded.
- [ ] Production Site URL and redirect allowlist are exact and tested from the deployed HTTPS origin.
- [ ] Vercel Production build uses the correct public Supabase URL/anon key; no secret key is in the browser bundle.
- [ ] New and returning user flows pass; onboarding profile writes and returning profile reads pass.
- [ ] RLS/grants and client-callable privileged RPCs have been checked against the live production database; known critical concerns are resolved.
- [ ] Support copy and email deliverability monitoring/ownership exist; an operator knows where to check Supabase Auth logs and provider bounces.
- [ ] A rollback owner can redeploy the last known-good frontend and revert the specific Auth/email settings without disabling verification.

**Rollback sequence:** pause invitations/announce login maintenance if necessary; revert frontend deployment to the last known-good build; restore previously recorded Supabase email template/URL settings; keep email verification and RLS enabled; inspect Auth logs and email-provider events; preserve accounts and data. Do not “fix” a release by enabling the hardcoded bypass or disabling Confirm Email in production.

## 10. Suggested execution order and completion evidence

1. **Inventory and decisions:** complete Sections 3–4. Evidence: environment/config record, approved eligibility decision, outstanding issues.
2. **Resolve security blockers:** inspect live database RLS, grants, and exposed RPCs; fix and review unsafe policies/functions. Evidence: SQL query results and cross-user authorization checks retained in the project’s secure engineering records.
3. **Prepare staging delivery:** configure test Supabase project, SMTP, template, Site URL, redirect allowlist, and test accounts. Evidence: successful delivery and OTP verification from a non-team address.
4. **Implement client changes:** remove bypass, strengthen request/verify screens, add resend and error handling, ensure verified email and profile routing. Evidence: reviewed diff and scenario results.
5. **Deploy to Preview/staging:** set Vercel Preview variables, allowlist approved preview origin, deploy, and execute the matrix. Evidence: build URL, commit SHA, test record.
6. **Prepare production:** configure production SMTP/Auth, canonical domain, production-only variables and live-database policy checks. Evidence: completed release gate checklist and rollback owner.
7. **Controlled production smoke test:** test a dedicated account from an allowed external/institutional mailbox, then a returning account; verify logout and policy behavior. Evidence: timestamped result without storing any OTP.
8. **Launch and monitor:** release invitations gradually, monitor send/verify error rates, bounces/spam, support requests, Auth rate limits, and failed profile creation. Set an owner and review cadence for the first launch period.

## 11. Known repository follow-up items (OTP-adjacent)

- Add an explicit verify route declaration to the auth stack if Expo Router's generated route behavior requires it; confirm rather than assume.
- `app/(auth)/index.tsx` and `verify.tsx` use React Native `Alert` for error UX. The web UI should provide inline accessible messages.
- Existing verification flow lacks resend. Existing notes identify this already.
- The root session guard and context both fetch auth/profile state; test asynchronous timing to avoid redirect loops after OTP. If fixing guard races, keep this change limited and add clear loading/error states.
- Onboarding `school` defaults to NorQuest and `INSTITUTIONS` marks UAlberta/MacEwan inactive; this can affect new-user success even when OTP works. Align email eligibility and onboarding school options before broad release.
- The checked-in database analysis documents potentially critical live RLS and privileged RPC risks. OTP verification alone does not establish that the app is safe to launch.

## 12. Official reference links

- [Supabase passwordless email sign-in and OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase redirect URL configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase testing Auth flows / hosted email limitations](https://supabase.com/docs/guides/auth/testing-auth-flows)
- [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)

The dashboard values for this specific project are authoritative where they differ from documentation defaults. The official docs currently describe a 60-second default per-user OTP request window, a one-hour default OTP expiry, and very limited built-in email delivery; confirm those values in the actual project before configuring UI timers or planning capacity.
