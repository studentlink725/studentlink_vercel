# StudentLink web demo

This copy restores the original StudentLink Expo Router screens and Supabase-backed account, profile, matching, events, and resource flows, configured for Expo Web and Vercel static output.

## Run on the studentdev host

```sh
./run.sh
```

The launcher installs the locked dependencies when needed and starts Expo Web on port 8084 through an Expo tunnel. It keeps Metro's temporary cache under the current user's home directory to avoid shared `/tmp` cache permission errors.

For a local browser without a tunnel, use `npm run web`.

## Supabase configuration

Copy `.env.example` to `.env` and set the Supabase project URL and anon key. The `.env` file is ignored by Git. For Vercel, add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the project's environment variables before building.

The browser app uses the Supabase anon key. Database access still depends on the project's configured Row Level Security policies.

## Build for Vercel

```sh
npm install
npm run build
```

Vercel uses `vercel.json` to build the static Expo web export in `dist`.
