# StudentLink web demo

A small, self-contained Expo Web showcase of StudentLink. It keeps the core product story—meeting students, discovering campus events, and finding support resources—using local sample data so it can be demonstrated without Supabase credentials.

## Run locally

```sh
npm install
npm run web
```

## Build for Vercel

The project uses Expo Router with static web output. Vercel can import this directory directly; the included `vercel.json` runs the web export and serves the generated `dist` directory.

```sh
npm run build
```

For a Vercel deployment, set the project root to this directory and use the default build settings from `vercel.json`.

## Demo limitations

Profiles, matches, events, and resources are sample content. Buttons demonstrate local interactions only; authentication, database writes, live matching, and RSVP persistence are not connected. This copy is intended for product demonstration, not as a production release.
