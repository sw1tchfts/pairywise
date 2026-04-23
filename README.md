# pairywise

Pairwise-comparison ranking app. Create a list of things, vote between pairs,
and see them ranked. Toggle between **ELO** and **Bradley-Terry** on the same
comparison data.

## Status

Client-only MVP (Phase 1). Data persists in `localStorage`. No backend yet —
the plan is to add Supabase in Phase 2 for accounts, public lists, and
aggregate group rankings.

## Features

- **Item types**: plain text, image URL, paste-a-link (OG-tag preview),
  movies/TV via TMDB.
- **Vote UI**: A-vs-B cards, `←` / `→` hotkeys, skip (`Space`), undo (`U`).
- **Adaptive pair selection**: prefers never-seen pairs first, then
  closest-rated pairs (most informative).
- **Rankings**: toggle between ELO (fast, partial data) and Bradley-Terry
  (full MLE) on the results page.
- **List management**: create, edit, duplicate, delete, tag lists.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Zustand (+ persist) ·
Zod · Vitest.

## Local dev

```sh
npm install
npm run dev      # http://localhost:3000
npm test         # run ranking unit tests
npm run build    # production build
```

Optional env vars (create `.env.local`):

```
TMDB_API_KEY=...                 # enables the "Movie/TV" item picker
NEXT_PUBLIC_SUPABASE_URL=...     # override the baked-in Supabase project
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Supabase

Auth, data, realtime, and audio uploads all live in a shared Supabase project
(URL + anon key are committed in `src/lib/supabase/env.ts`). To provision a
fresh project, run the SQL in [`supabase/schema.sql`](./supabase/schema.sql)
and follow [`supabase/README.md`](./supabase/README.md).

## Project layout

```
src/
  app/                       # Next.js routes
    page.tsx                 # home (list of lists)
    lists/new/page.tsx       # create flow
    lists/[id]/page.tsx      # list detail + item picker
    lists/[id]/vote/page.tsx # A-vs-B voting
    lists/[id]/results/page.tsx
    api/og/route.ts          # OG-tag scraper
    api/tmdb/search/route.ts # TMDB proxy
  components/
    VoteScreen.tsx · VoteCard.tsx · ItemPicker.tsx
    UrlPreviewInput.tsx · TmdbSearchInput.tsx
    Leaderboard.tsx · AlgorithmToggle.tsx
  lib/
    types.ts · store.ts · utils.ts
    ranking/
      elo.ts · bradleyTerry.ts · pairSelection.ts
      index.ts (unified `rank(algorithm, items, comparisons)`)
```

## Roadmap

Phase 2 (community features): Supabase auth, public/unlisted lists, browse
trending, aggregate rankings across voters, comments, follows.

Deferred: tournament bracket mode, tier-list mode, rating-history chart,
share links, Spotify / YouTube item types.
