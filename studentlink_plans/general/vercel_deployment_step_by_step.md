# StudentLink: Step-by-Step Vercel Deployment Plan (Before OTP Is Ready)

**Goal:** get the current StudentLink web build onto Vercel now, while email OTP work continues separately.

**Important scope:** this deploy publishes the existing app. It does not finish authentication or make the current login safe for real users. Start with a Preview deployment for the owner/team. Promote to a public Production deployment only after the gates in this guide are met.

## 1. What is already set up in this repository

- This is the `studentlink_vercel` app: Expo 54, Expo Router, React Native Web, TypeScript, and Supabase JS.
- `npm run build` is configured as `expo export --platform web`; Vercel's `vercel.json` already specifies `npm run build` and `dist` as the output directory.
- `vercel.json` also rewrites all request paths to `/`. The Expo export contains route files under `dist`; the rewrite must be checked against actual routes on the deployed URL. Do not change it preemptively—first test direct loads and refreshes, and let AI inspect a concrete failing route if one appears.
- The repository's `main` branch is connected locally to `studentlink725/studentlink_vercel` through `origin` (GitHub host alias `github-work`). Vercel can use GitHub deployments if the account that authorizes Vercel can access this repository. If it cannot, fix repository permissions or use the CLI route below.
- `.env.example` names two required build-time variables: `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Vercel must receive the correct values before the build. They are compiled into the browser app; the anon key is public by design and is not a substitute for database RLS.
- There is **no Vercel-specific runtime backend** in this repository. Vercel serves the static Expo web export; Supabase remains the Auth/database backend.
- Current login is intentionally unfinished for this deployment: `app/(auth)/index.tsx` has `BYPASS_AUTH = true`, which uses a shared hardcoded password path instead of OTP. This is a release blocker for real users. The bypass must not be advertised as secure authentication. Depending on Supabase email-confirmation settings, the new-account branch may also receive no session and onboarding can redirect back to login. The static website can deploy while login remains unreliable.
- The repository notes unresolved live Supabase RLS and privileged RPC concerns. Making the site reachable does not make the backend safe. Do not expose real student data or invite real users until the OTP and database-security gates are complete.

## 2. Recommended approach

Use Vercel's Git integration for repeatable builds and Preview deployments on feature branches. Keep `main` as the intended production branch, but do not assume the first import will be a Preview: Vercel can treat the initial/default-branch deployment as Production. If you need a controlled preview, push/import a separate branch and confirm the deployment's environment label and protection before sharing its URL. The user should do only the browser/account authorization, environment-variable entry, and any domain/DNS work that require their credentials or ownership. AI can inspect/change code in the repo, prepare settings, interpret build logs, and guide verification.

Do not use Vercel's Sites hosting connector for this task: the target is the user's existing Vercel project and GitHub repository, and no Vercel account connector is available in this workspace. I also cannot authorize the user's Vercel/GitHub accounts from this project directory. This guide prepares the deployment path; account linking and deployment clicks must happen in the user's Vercel session.

## 3. Before you start: make the deployment safe and reproducible

1. **Use the right GitHub account and organization.** Confirm the repository belongs to the intended StudentLink owner/org and that the account used in Vercel is authorized to import it. Confirm `main` is the intended deployment branch.
2. **Decide the first audience.** For now choose a Preview deployment or a protected staging site. Vercel may mark the first import as Production, so check its environment label and protection settings before sharing it. Do not promote the app with the bypass exposed to a general audience. Deployment URLs can be shareable; use Vercel Deployment Protection if your plan supports it, or keep the URL undistributed until access controls and auth are ready.
3. **Choose the Supabase project.** Prefer a non-production/staging Supabase project for this pre-OTP deployment. If using the current project, confirm it has no real-user data and review live RLS before sharing. Never use the service-role key in the client.
4. **Find the two public client values without revealing them in chat or Git.** From Supabase Project Settings → API (dashboard labels may vary), copy the project URL and anon/publishable key. The key is expected to be visible in browser code. Never copy the `service_role` or secret key into this app, Vercel `EXPO_PUBLIC_*` settings, or an AI prompt.
5. **Confirm repository state.** Commit only intended source changes. Do not commit `.env`; `.gitignore` excludes `.env` and `.env.*` except `.env.example`. The Vercel deployment will use GitHub's pushed commit, not uncommitted local changes.
6. **Decide what to do with login while OTP is pending.** Best option for a team-only preview: leave the app as-is and treat login as unavailable/experimental. If testers need to view screens, AI can make a clearly labeled, non-production demo mode on a separate branch that uses mock/sample data and cannot access Supabase student records. Do not add or expose a master bypass/shared password to a public deployment.

## 4. AI-led setup: prompts to use

Run these prompts in Codex while working in `~/remote_workspace/studentlink/studentlink_vercel`. AI can do repo-side work without needing your Vercel login. Review the diff before pushing any code.

### Prompt 1 — deployment readiness audit (read-only)

> Inspect this repository for Vercel deployment readiness only. Do not edit files, run tests, deploy, or reveal environment-variable values. Confirm the Expo web build command/output directory, inspect `vercel.json` rewrites against Expo Router routes, list the environment variable names the web build needs, identify whether any secrets could be bundled into the client, and summarize the current login/auth limitation caused by the OTP bypass. Give me a short checklist of any required code/config changes before a Preview deployment. Treat the Vercel deployment as staging until OTP and live Supabase RLS review are complete.

### Prompt 2 — make only necessary Vercel config fixes (if audit finds issues)

> Based on your Vercel readiness audit, make only the smallest repository changes needed for an Expo Router static web export on Vercel. Preserve `npm run build` and `dist` unless the repo proves those are wrong. Do not add API routes, secrets, auth bypasses, or new services. Keep all deep links/direct refreshes working. Explain each file changed and why, and show the exact diff. Do not deploy or push.

### Prompt 3 — inspect an actual Vercel build failure

> Here are the Vercel build logs: [paste logs with tokens, email addresses, and secret values removed]. Diagnose the first actionable failure against this Expo 54 project. Propose the smallest fix, edit only if the cause is clear, and explain how I can redeploy. Do not change Supabase secrets or authentication security settings.

### Prompt 4 — inspect deployed-route failure

> The deployed StudentLink URL [paste URL] behaves like this: [describe exact path, browser action, and result]. Review this repository's Expo Router export and `vercel.json`; identify whether the rewrite or generated export causes it. Make the smallest necessary change and show the diff. Do not weaken auth or expose student data. Provide a short set of direct-route/refresh checks for me to perform after redeploy.

### Prompt 5 — later, after OTP work is complete

> Review the deployed StudentLink app against `studentlink_plans/general/vercel_email_otp_release_plan.md`. Do not assume the release plan is complete: inspect the current code and report which OTP release gates remain, then prepare a production deployment checklist. Do not switch Vercel to Production or change Supabase production settings without my explicit instruction.

## 5. Deployment path A — Vercel dashboard with GitHub (recommended)

### Step A1 — authorize/import the repository (manual)

1. Sign in to the Vercel account/team that should own StudentLink deployments.
2. Select **Add New → Project** (Vercel may label this **New Project**).
3. Connect/choose GitHub if it is not already connected. Authorize access only to the StudentLink repository if Vercel offers repository selection.
4. Import `studentlink725/studentlink_vercel` (or the canonical organization-owned repository if ownership has changed). If it is not visible, stop and fix GitHub App/repository permissions; do not make the repo public just to get it listed.
5. Set the project name, e.g. `studentlink-vercel`, and confirm **Root Directory** is the repository root (`./`), because `package.json` and `vercel.json` are at the root.

### Step A2 — set project build settings (manual check; AI can advise)

Use these values if Vercel does not read them from `vercel.json`:

| Setting | Value |
|---|---|
| Framework preset | Expo if detected; otherwise Other (the explicit build config below is what matters) |
| Root directory | `./` (repository root) |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | Leave Vercel's npm detection/default unless its log shows a specific install problem |
| Production branch | `main` only when ready; first deployment can remain a preview/staging deployment |

The existing `vercel.json` already configures build command/output directory/rewrites. Avoid duplicate conflicting dashboard overrides unless Vercel's import screen requires them. Do not add Vercel Functions for this static frontend.

### Step A3 — add the Supabase client config (manual secret/value entry)

1. In the import screen, or after creation in **Project → Settings → Environment Variables**, add:
   - `EXPO_PUBLIC_SUPABASE_URL` = the staging Supabase project URL.
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = that same project's anon/publishable key.
2. Select **Preview** and **Production** scopes intentionally. If OTP is not ready and the site is only a preview, configure Preview only. If adding Production values, understand that the app can still deploy publicly and the login bypass is not production-ready.
3. Never add `SUPABASE_SERVICE_ROLE_KEY`, SMTP credentials, database passwords, or Supabase personal access tokens. There is no server-side code in this project that needs them.
4. Save values using the Vercel dashboard directly. Do not paste secret-looking values into a Codex chat. If the key was accidentally committed or pasted into an untrusted place, rotate it in Supabase before public deployment.

### Step A4 — create the first deployment (manual click, AI can monitor logs if pasted)

1. If importing from the configured production branch automatically creates a Production deployment, do not share it; first review access controls. To get a Preview deployment, push a separate feature/staging branch and wait for its deployment, or use the CLI Preview flow in Section 6. Check the deployment's environment and branch before sharing its URL.
2. Wait for the build to finish. If it fails, copy only the relevant error lines into Prompt 3 after removing any credentials/PII. Do not repeatedly change Node versions or dependency versions without a log-based reason.
3. If the build succeeds, open the generated `vercel.app` URL and run the checks in Section 7. Treat the Vercel URL as a staging URL until the app and auth are ready.

### Step A5 — connect future code changes (manual once)

1. In Vercel **Settings → Git**, confirm the correct production branch and Git repository.
2. Future pushes/PRs to other branches should create Preview deployments; merges to the configured production branch create Production deployments. Keep OTP work on a branch and check its Preview URL before merging.
3. Only merge/deploy to the Production branch when the release gates in Section 9 are satisfied. If using `main` for active development, set a separate stable production branch or require PR review before merges.

## 6. Deployment path B — Vercel CLI (fallback)

Use this only if Git import is not available. CLI deployment still requires your Vercel account login and repository/build files; it is not a way around account authorization.

1. Install/use the official Vercel CLI only if it is not already available. AI can explain the command, but you must authenticate through the CLI's browser flow. Do not paste a Vercel token into chat or source files.
2. From the project root, run `vercel` to link the directory to your Vercel account/team and create a **Preview** deployment. Confirm project name/root directory when prompted.
3. Add the two `EXPO_PUBLIC_*` values using **Project Settings → Environment Variables** or a secure CLI environment prompt. Avoid shell history that records credentials. Do not put values on a command line or in a committed file.
4. Run `vercel` for Preview deployments. Use `vercel --prod` only when intentionally publishing a production deployment and all production gates are passed.
5. Prefer Git integration after initial CLI setup so deployments are tied to commits and PR previews are repeatable.

## 7. Deployment verification (do these after each first deployment)

These are manual browser checks; AI can help diagnose results from descriptions/logs.

1. **Home route:** open the Vercel URL in a clean browser tab. Confirm the app renders without a blank page or fatal console error.
2. **Route behavior:** open `/`, `/verify`, `/onboarding`, `/events`, `/matching`, `/profile`, and `/resources` (Expo Router route groups in parentheses do not normally appear in the web URL). Then refresh directly on a nested route and use browser Back/Forward. Compare with the generated paths in `dist/_expo/.routes.json` if a route behaves differently.
3. **Assets:** check images/icons/fonts and styling load on the Vercel origin. Check browser devtools Network for 404s. Check a mobile-sized viewport.
4. **Supabase configuration:** from browser devtools, confirm the Supabase URL and anon/publishable key are the intended staging project values; never expose or search for service-role credentials. If the app reports invalid URL/key, fix the Vercel environment values and redeploy.
5. **Auth status:** expect that login may fail or onboarding may redirect because OTP is not enabled and the hardcoded bypass may not establish a session when email confirmation is required. Record the exact outcome; do not disable production confirmation or loosen RLS to force a pass.
6. **Protected data:** do not test using real student accounts/data until the live RLS audit is complete. If staging test records are used, confirm one user cannot read another user's private row.
7. **Logs:** review Vercel build/runtime logs and browser console for errors. This project is static, so application errors will usually be browser/Supabase errors, not Vercel server logs.

## 8. Optional: custom domain (manual domain-owner action)

Do this only after a staging deployment is verified and the project owner chooses the public hostname.

1. In Vercel **Project → Settings → Domains**, add the chosen hostname.
2. Follow the exact DNS records Vercel displays for that domain (apex domain vs subdomain differ). Add them at the domain registrar/DNS host. Do not guess A/CNAME values from a tutorial because Vercel may show project-specific records.
3. Wait for Vercel to report the domain configured and HTTPS certificate ready. Test the canonical URL and any `www` redirect.
4. Record the final hostname. When OTP is later configured, update Supabase Site URL/redirect allowlist to match the real production domain; for now no auth callback setup is needed for the code-entry flow.
5. Do not change DNS/nameservers without understanding other existing records on the domain. The person who owns the domain must make this change.

## 9. Production promotion gates (OTP can come later, but these are not optional)

If the current release only needs a live team preview, stop after Section 7. If the site is intended for the public, do not promote this current build as-is.

- [ ] OTP implementation is complete and the bypass/shared password path is removed. See `studentlink_plans/general/vercel_email_otp_release_plan.md`.
- [ ] Supabase email provider, production email template, Site URL, redirects, and rate limits are tested.
- [ ] Live Supabase RLS/grants and client-callable privileged functions have been reviewed and critical findings resolved. The checked-in database analysis explicitly lists items requiring live verification.
- [ ] Vercel Production variables use the production Supabase project and contain only the public client URL/key.
- [ ] New-user and returning-user login, onboarding, logout, and direct route refreshes pass on the production domain.
- [ ] The app's privacy/terms/support details and chosen student email eligibility policy are ready for intended users.
- [ ] A rollback owner and process are known.

**Why not publish now for general users:** the bypass uses the same hardcoded password for all addresses and tries password sign-in/sign-up. This is not a secure login. Also, if Supabase requires email confirmation, `signUp` may not establish a session, so a user can be routed to onboarding only to be redirected away by the root auth guard. A reachable Vercel page is not equivalent to a working, secure release.

## 10. Troubleshooting map

| Symptom | First check |
|---|---|
| Vercel cannot see the repository | GitHub integration authorization and repository/org access; do not change repo visibility by default. |
| Build says `expo: command not found` | Confirm Root Directory points to package.json and Vercel runs dependency installation; inspect full install/build log. |
| Build succeeds but page is blank | Browser console, Expo export output, correct output directory `dist`, and JS asset 404s. |
| Root works but nested refresh is 404 or wrong screen | Generated `dist` paths and existing broad rewrite. Use Prompt 4 with exact URL and result before editing config. |
| Login says invalid API URL/key | Check the two exact Vercel env names and values; redeploy because Expo public vars are compiled at build time. |
| Auth succeeds but profile is empty/forbidden | Check RLS policy and the authenticated user's `students` row; never solve by granting broad anon access. |
| A deployment shows stale UI after env change | Start a fresh deployment; environment changes do not rewrite prior static bundles. |
| Preview differs from local | Confirm branch/commit, Preview env scope, install/build logs, and that the local change was committed/pushed. |

## 11. Rollback and redeploy

1. In Vercel **Deployments**, find the last deployment known to work and redeploy or promote it according to the Vercel UI.
2. If a bad commit is the cause, revert it in Git, push the revert, and allow Vercel to rebuild. Keep the repository history intact; do not force-push/reset as a shortcut.
3. If a bad environment variable is the cause, correct its environment scope/value in Vercel, then redeploy so the static export is rebuilt with those values.
4. If a custom domain was added, leave it attached to the project and roll the project deployment back; only change DNS if the domain itself must be moved.
5. Keep Supabase email confirmation and RLS enabled. Do not restore the bypass as an emergency production fix.

## 12. What you will need to do manually vs what AI can do

### Manual (account/domain actions)

- Sign in to Vercel and authorize the GitHub repository/team.
- Choose the Vercel team/project owner, confirm billing/plan, and choose whether this is Preview or Production.
- Copy the correct Supabase project URL and public anon/publishable key into Vercel's environment settings.
- Click Deploy/import and, if desired, add the domain and make DNS changes through the domain owner.
- Open the deployed URL and confirm the visible behavior; report errors without sharing secret values.

### AI (repo and analysis work)

- Audit and adjust `vercel.json`/Expo export config if an actual issue is found.
- Prepare a branch/commit, diagnose redacted build logs, and fix concrete code/config issues.
- Check deep links, runtime errors, and whether deployment variables are referenced correctly.
- Review the app/auth/RLS release gates, prepare the production checklist, and help interpret test results.
- Once you paste the deployment URL or redacted error details, guide the next steps without needing your account password or secret keys.

## 13. Official references

- [Vercel Git deployments](https://vercel.com/docs/git)
- [Vercel build configuration](https://vercel.com/docs/builds/configure-a-build)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel custom domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
- [Vercel deployments and rollback](https://vercel.com/docs/deployments)

Vercel's dashboard is authoritative for current project settings, plan capabilities, and DNS records. Supabase project-specific Auth and RLS settings are authoritative for backend behavior.
