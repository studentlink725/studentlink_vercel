# StudentLink Development Workspace Plan

This document describes the intended development workspace setup for the StudentLink initiative.

It should be updated as the setup evolves.

## Goal

Create a development environment where the StudentLink project can be worked on from either `unimatrix01` or `unimatrix02`, while keeping the project files in shared storage hosted on `unimatrix02`:

```txt
/root/remote_workspace/studentlink
```

On `unimatrix01`, this storage may be exposed through the SSHFS mount:

```txt
/root/unimatrix02_workspace
```

This allows a work laptop to SSH into the server environment and develop the app from whichever machine is most useful for the current task.

## StudentLink Project Context

The roadmap in `studentlink_roadmap.md` defines StudentLink as:

- A mobile app for university students
- Built with React Native
- Managed with Expo and EAS
- Backed by Supabase/PostgreSQL
- Intended for iOS and Android release

Because this is an Expo/React Native app, the development workflow will involve:

- Node.js
- npm or another JavaScript package manager
- Expo CLI
- Metro bundler
- Supabase project configuration
- EAS build configuration
- Mobile device testing through Expo Go or development builds

These tools can be sensitive to filesystem performance and file watching behavior.

## Recommended Workspace Structure

Current structure:

```txt
/root/remote_workspace/studentlink/
├── studentlink_roadmap.md
├── studentlink_dev_workspace_plan.md
└── StudentLink/
    ├── App.js
    ├── package.json
    ├── app.json
    ├── babel.config.js
    ├── package-lock.json
    ├── .gitignore
    └── README.md
```

The `StudentLink/` directory is the actual application repository. It was
created as a private GitHub repository and cloned into the shared workspace.

A separate non-root Expo testing copy may exist at:

```txt
/home/studentdev/projects/StudentLink
```

That copy should be treated as a disposable development/test clone. GitHub is
the source of truth between the shared root workspace and the `studentdev`
testing workspace.

## Recommended Operating Model

Use `/root/remote_workspace/studentlink/StudentLink` as the main shared project home on `unimatrix02`, but use GitHub as the real source of truth.

Recommended rules:

- Keep the main StudentLink source code in `/root/remote_workspace/studentlink/StudentLink`.
- Use the private GitHub repository as the canonical source of truth.
- Commit changes often, especially before switching between machines.
- Prefer one active development machine at a time.
- Avoid running package installs, Expo, Metro, or build tooling from both machines at once.
- Prefer running heavy Node/Expo workflows on the machine that has the best local access to the files.
- Use the other machine for specific tasks when it has a clear advantage.
- Run Expo from a normal user account such as `studentdev`, not from `root`, when testing on a phone.

## Expected Machine Roles

### unimatrix02

Default development host.

Reasons:

- The shared workspace storage physically lives on `unimatrix02`.
- Running Node, Expo, package installs, and file watchers directly where the files live should be more reliable than running them through SSHFS.
- Good candidate for the main StudentLink repo, dev server, and long-running processes.
- A non-root `studentdev` user can run Expo without the root/Electron sandbox issue.

### unimatrix01

Useful secondary development host.

Possible uses:

- Editing shared files through the mounted workspace
- Running commands when `unimatrix01` has a specific tool, network path, or hardware advantage
- Inspecting, testing, or coordinating files without copying them

Avoid treating both machines as simultaneously active writers to the same working tree.

## Work Laptop Workflow

The expected workflow is:

1. Use the work laptop to SSH into the server environment.
2. Connect to either `unimatrix01` or `unimatrix02`, depending on the task.
3. Work inside `/root/remote_workspace/studentlink/StudentLink` for source changes, or `/home/studentdev/projects/StudentLink` for non-root Expo testing.
4. Run development tools primarily from the active development host.
5. Use Expo tooling for mobile preview and testing.

For remote mobile development, Expo tunnel mode may be useful:

```sh
npx expo start --tunnel
```

This can make it easier to connect a physical phone to the development server when the phone is not on the same local network.

For the current `studentdev` test clone:

```sh
su - studentdev
cd ~/projects/StudentLink
npx expo start --tunnel --clear --port 8084
```

Expo tunnel has successfully started and produced a QR code from this location.
The current blocker is Expo Go compatibility with the project's SDK version, not
the tunnel itself.

## Pros of This Setup

- One shared location for StudentLink files.
- No manual copying between `unimatrix01` and `unimatrix02`.
- Flexible access from either machine.
- Helpful for a work-laptop-over-SSH workflow.
- Good for shared notes, roadmap files, Supabase SQL, migrations, config templates, and project documentation.
- Keeps the StudentLink initiative organized inside a known shared workspace.

## Cons and Risks

### SSHFS Performance

`/root/unimatrix02_workspace` is an SSHFS-mounted filesystem when accessed from `unimatrix01`.

React Native and Expo projects can involve many small files. This can make SSHFS slower than a normal local filesystem.

### File Watching

Expo and Metro rely on file watching. File watching can be less reliable over SSHFS.

Possible symptoms:

- Changes not detected
- Slow reloads
- Extra restarts needed
- Inconsistent Metro behavior

### node_modules

`node_modules` contains many files and can be slow or fragile over SSHFS.

Package installs should generally be run from the machine that is acting as the active development host.

### Concurrent Access

Running commands from both machines at the same time against the same project directory can cause conflicts.

Avoid doing these simultaneously from different machines:

- `npm install`
- `npm update`
- Expo dev server
- Metro bundler
- EAS build setup
- Git operations that modify the working tree
- Code generation or migration generation

### Root vs Non-Root Expo

Running Expo as `root` on `unimatrix02` triggered a React Native DevTools /
Electron sandbox error:

```txt
Running as root without --no-sandbox is not supported
```

This was avoided by running Expo from the `studentdev` user in `/home/studentdev`.
Do not loosen `/root` permissions to solve this. Use a normal-user clone and
sync through GitHub instead.

### Expo Go SDK Compatibility

The initial scaffold used Expo SDK 56, which was incompatible with the available
Expo Go app on the testing device. To resolve this, the project was downgraded
to Expo SDK 54.0.25 to ensure compatibility with the current Expo Go runtime.

### Mount Reliability

The workspace mount was observed as:

```txt
TARGET: /root/unimatrix02_workspace
SOURCE: u2:/root/remote_workspace
TYPE:   fuse.sshfs
```

The mount was not found in `/etc/fstab` on `unimatrix01`, so it may not automatically persist after reboot unless another startup process mounts it.

The mount table also showed duplicate entries for the same SSHFS mount, one marked `ro` and one marked `rw`. Writes were working, but this should be cleaned up or at least understood if the workspace becomes critical.

## Git Strategy

Git should be used from the beginning.

Recommended:

- Initialize `/root/unimatrix02_workspace/studentlink` as a Git repository.
- Keep a remote Git host if possible, such as GitHub or a private server.
- Commit before switching active machines.
- Pull/check status before starting work on another machine.
- Keep generated or machine-specific files out of Git.

Expected `.gitignore` should include typical Expo/React Native ignores:

```txt
node_modules/
.expo/
dist/
build/
android/
ios/
.env
.env.*
```

Environment templates can be committed, for example:

```txt
.env.example
```

Actual secrets should not be committed.

## Secrets and Credentials

StudentLink will likely involve:

- Supabase project URL
- Supabase anon key
- Supabase service role key
- Expo account access
- EAS credentials
- Apple Developer credentials
- Google Play credentials

Rules:

- Do not commit real secrets.
- Keep `.env` files out of Git.
- Commit `.env.example` with placeholder values.
- Be especially careful with Supabase service role keys.
- Avoid storing long-lived production credentials casually in the shared workspace.

## Suggested First Setup Steps

Completed setup steps:

1. Created a private GitHub repository: `KelvinCreighton/StudentLink`.
2. Cloned it into `/root/remote_workspace/studentlink/StudentLink`.
3. Created a minimal Expo hello-world app.
4. Added `README.md`, `.gitignore`, `App.js`, `app.json`, `babel.config.js`, `package.json`, and `package-lock.json`.
5. Installed dependencies.
6. Created and tested a non-root `studentdev` Expo workflow.
7. Confirmed Expo tunnel can start and produce a QR code from the `studentdev` clone.
8. Resolved Expo Go SDK compatibility by downgrading the project to Expo SDK 54.0.35.
9. Added Supabase database setup schema, RLS policy script (`studentlink_rls_setup.sql`), and environment configuration templates.

Open setup items:

1. None (Core development workspace setup is stable and complete).


## Useful Commands

Check whether the shared workspace is mounted:

```sh
mountpoint /root/unimatrix02_workspace
```

Show mount details:

```sh
findmnt /root/unimatrix02_workspace
```

Show available space:

```sh
df -hT /root/unimatrix02_workspace
```

Check the SSH alias:

```sh
ssh -G u2
```

Check current project state once the repo exists:

```sh
cd /root/unimatrix02_workspace/studentlink
git status
```

## Current Recommendation

Use `/root/remote_workspace/studentlink` as the shared home for StudentLink on `unimatrix02`, but do not rely on SSHFS as if it were a perfect local disk from `unimatrix01`.

Best practice:

- Store the project in the shared workspace.
- Use Git for safety and history.
- Run heavy development workflows from one active machine at a time.
- Prefer `unimatrix02` as the default active development host unless `unimatrix01` has a specific advantage for a task.
ere a perfect local disk from `unimatrix01`.

Best practice:

- Store the project in the shared workspace.
- Use Git for safety and history.
- Run heavy development workflows from one active machine at a time.
- Prefer `unimatrix02` as the default active development host unless `unimatrix01` has a specific advantage for a task.
