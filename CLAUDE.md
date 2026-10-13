# Overtone

Ear-training web app for musicians, beginner through advanced. Core is
**functional (scale-degree) training**, with honest progress tracking and a daily
challenge everyone shares. Next.js PWA on Vercel first, structured so it can be
wrapped with Capacitor for the App Store later.

**`docs/SPEC.md` is the source of truth.** Read it before each phase. This file is
the short version. `docs/DESIGN.md` is the design system.

## Stack

- **App:** Next.js 16 (App Router) + TypeScript, pnpm, Tailwind CSS v4, `next-themes`.
- **State:** Zustand (live session), TanStack Query (server data). _Not yet installed._
- **Audio:** Tone.js `Sampler` per instrument, real samples, lazy-loaded, SW-cached.
- **Music logic:** `tonal`; all generation pure + seeded (same seed = same questions).
- **Backend:** Supabase (Auth + Postgres with RLS + Edge Functions).
- **Testing:** Vitest (logic + components), Playwright (flows, Phase 8).
- **Quality:** ESLint flat config + Prettier; GitHub Actions on every push.

Three things sit behind interfaces so they can be swapped: the **audio engine**,
the **question generators**, and the **data layer** (`DataStore`: `LocalStore` now,
`SupabaseStore` later).

## Commands

```bash
pnpm dev            # dev server on http://localhost:3000
pnpm build          # production build
pnpm lint           # eslint (NOT `next lint` — removed in Next 16)
pnpm typecheck      # tsc --noEmit
pnpm test           # vitest run
pnpm contrast       # verify design-token contrast ratios
pnpm format         # prettier --write
pnpm samples        # download instrument samples named in the audio manifest
pnpm samples:check  # report any manifest sample missing from public/samples
pnpm tonal:check    # diagnose the tonal packaging problem (see Gotchas)
```

`/dev/sound` is a hidden bench for auditioning the audio engine — instruments,
cadences, degrees, chords, noise bursts and a real generated question. Not linked
from the app, `noindex`, but left reachable on deploys so it can be checked on a
real phone.

## Folder layout

```
src/
  app/            routes: learn, practice, play, stats, settings, challenge/[id], auth
  components/     ui/ (design-system pieces), drill/, instruments/ (Piano, Fretboard)
                  home/, settings/ — screen-specific composites
  lib/audio/      AudioEngine interface + ToneAudioEngine, event types, instrument manifest
  lib/theory/     notes, keys, degrees, intervals, chords, romanNumerals, voicing, cadence
  lib/modes/      types.ts (Generator contract), sound.ts ("vary the sound"), one
                  generator per mode: scaleDegrees, intervals, chords, progressions, dictation
  lib/rng.ts      seeded RNG (mulberry32) — generators never touch Math.random
  lib/learning/   adaptive levels, Leitner review, mastery rules, placement test
  lib/data/       DataStore interface + SupabaseStore + LocalStore (offline / signed-out)
  lib/midi/       Web MIDI input
  lib/mock/       Phase-1 placeholder data — delete as real data lands
supabase/         migrations, seed, edge functions
public/samples/   instrument samples, one folder per instrument
docs/             SPEC.md (the plan), DESIGN.md (tokens), CREDITS.md (sample licences)
scripts/          check-contrast.mjs, fetch-samples.mjs, check-tonal-resolution.mjs
```

## Design tokens

Defined once in `src/app/globals.css`: light values in `@theme` (emitted on
`:root`), dark values re-bound under `[data-theme="dark"]`. Tailwind utilities
compile to `var(--color-*)`, so the UI re-themes with **no `dark:` variants in
component code**. `next-themes` writes `data-theme`, defaulting to `system`.

| Token                                   | Light                 | Dark                  |
| --------------------------------------- | --------------------- | --------------------- |
| `bg`                                    | `#F7F3EA`             | `#14171C`             |
| `surface`                               | `#FFFCF7`             | `#1C2027`             |
| `primary` / `primary-fg`                | `#183153` / `#FFFCF7` | `#8FB0DA` / `#14171C` |
| `accent` (marks)                        | `#B8654B`             | `#D98A6F`             |
| `accent-strong` (text bg) / `accent-fg` | `#A65B44` / `#FFFCF7` | `#D98A6F` / `#14171C` |
| `text`                                  | `#292D33`             | `#EDE8DE`             |
| `muted`                                 | `#6B655C`             | `#A39C90`             |
| `border`                                | `#DDD6CA`             | `#2E333B`             |
| `track`                                 | `#E6DFD2`             | `#2A2F37`             |
| `success` / `success-tint`              | `#2F6B4A` / `#E7F0E8` | `#5FB383` / `#17291F` |
| `danger` / `danger-tint`                | `#A8322D` / `#F6E4E1` | `#E07A6E` / `#2C1B1A` |

Type: **Space Grotesk** (`font-sans`) for UI; **JetBrains Mono** (`font-mono`) for
labels, levels, timers, scores, chips. Shape: `rounded-card` 20px,
`rounded-control` 14px. See `docs/DESIGN.md` for the full rules.

## Coding rules

- **TypeScript strict; no `any`.** `noUncheckedIndexedAccess` is on — index
  access is `T | undefined`, handle it.
- **Mobile first** at 390px; centre the app at `max-w-[480px]` on desktop.
  Phase 8 adds a real two-column desktop layout.
- **Accessible:** real `<button>`/`<a>`, `IconButton` requires a `label`, every
  touch target ≥44px (`min-h-11` / `size-11`), text contrast ≥4.5:1
  (`pnpm contrast`), `prefers-reduced-motion` respected globally.
- **Never colour alone** for correct/wrong — always an icon plus text.
- **Keep music logic, audio and data access out of components.** They live in
  `src/lib`. Components receive data as props.
- **No hard-coded colours.** Add a token instead.
- **Seeded randomness only** in generators — never `Math.random()`.
- Commit per meaningful unit of work, with a descriptive message.

## Gotchas

- `next lint` was **removed in Next 16** — the `lint` script runs `eslint` directly
  against `eslint.config.mjs`, which imports `eslint-config-next`'s flat configs
  (no `FlatCompat`).
- **TypeScript is pinned to 5.9.3.** `typescript@7` (the native compiler) is
  `latest` on npm but typescript-eslint does not support it yet, and lint dies
  with "typescript-eslint does not support TS 7.0". Don't bump it until
  typescript-eslint ships support.
- The React Compiler lint rules are active: `react-hooks/set-state-in-effect`
  rejects the usual `useEffect(() => setMounted(true), [])` mount guard. Use
  `useIsHydrated()` (`src/lib/hooks/`), which wraps `useSyncExternalStore`.
- `pnpm` build scripts are gated. Approving one writes to `allowBuilds` in
  `pnpm-workspace.yaml` (pnpm 12 moved these settings out of `package.json`).
- The home page is `force-dynamic` so the time-of-day greeting isn't baked in at
  build time. Phase 6 replaces it with the user's own time zone.
- The tab bar has exactly four tabs per the spec (Learn, Practice, Play, Stats);
  **Home is `/`, reached via the "overtone." wordmark**, and the avatar links to
  `/settings`.
- Audio must be unlocked by a user tap (iOS rule) — the first play button does it.
- `next dev` writes and re-adds `AGENTS.md` itself — commit it, don't delete it.
  Next 16 has breaking changes vs. older docs; the real reference is
  `node_modules/next/dist/docs/`. Check there before trusting memory of Next APIs.
- **`tonal` is pinned to exactly `6.4.3`, and three `@tonaljs/*` packages are
  pinned under `overrides` in `pnpm-workspace.yaml`.** The 6.5.0 wave of releases
  switched build tool and ships `dist/index.cjs` while `package.json` still says
  `main: dist/index.js`, so _nothing_ can resolve them — not Node, not Vite, not
  Turbopack. Symptom is `Cannot find module .../dist/index.js`. Run
  `pnpm tonal:check` to get the named list of culprits instead of guessing, and
  don't unpin until upstream fixes the `main` fields. Do not "fix" this with Vite
  `mainFields`/`deps.inline`: the ESM build's CJS interop is also broken (half
  the named exports end up under `default`), so the CJS path is the working one.
- **Tone.js is imported dynamically** inside `ToneAudioEngine`, with a top-level
  `import type * as Tone` for the types. A static runtime import breaks SSR and
  bloats the initial bundle. The engine prefetches the module on construction so
  `unlock()` inside a tap handler doesn't lose iOS's user-activation flag.
- The React Compiler lint rules also ban **reading a mutable singleton during
  render** and **calling `Date.now()` in component scope**. `SoundLab` mirrors
  engine state (`unlocked`, `loaded`) into `useState` and seeds from a counter
  rather than a clock. Fetch the engine via `getAudioEngine()` inside handlers.
- Sample files spell sharps with `s` (`G#3` → `Gs3.mp3`); `sampleFileName()` is
  the only place that conversion lives.
- The **cadence never rotates instruments** — it always plays on
  `REFERENCE_INSTRUMENT` (piano). A voiced I–IV–V–I spans ~2 octaves, which no
  single-octave sample set can hold; only the question itself rotates.

## Phase status

- [x] **Phase 1 — Foundation.** Scaffold, design tokens, base UI, app shell, Home
      screen, placeholder tabs, CI.
- [x] **Phase 2 — Sound and music-theory engine.** `AudioEngine` + `ToneAudioEngine`,
      `tonal` theory helpers, cadence builder, seeded RNG, generator contract,
      `/dev/sound` page.
- [ ] **Phase 3 — The core scale-degree drill.** First point the app is actually
      usable: generator, learning engine (adaptive choices, Leitner, level tests),
      drill screen, feedback, session summary, Listen mode, Learn tab, `LocalStore`.
- [ ] **Phase 4 — Accounts and synced progress.** Supabase migrations + RLS, auth,
      `SupabaseStore`, local→account merge, offline queue, `can()`, Settings.
- [ ] **Phase 5 — Other modes + instruments.** Intervals, chords, progressions,
      dictation; SVG Piano and Fretboard; mixed review.
- [ ] **Phase 6 — Placement test, daily challenge, streaks.** Onboarding, adaptive
      placement, server-scored daily challenge, streaks with freezes, reminders.
- [ ] **Phase 7 — Async challenges, friends, leaderboards.** Share links, friends,
      leaderboard views, privacy controls.
- [ ] **Phase 8 — Stats, MIDI, PWA polish, launch.** Charts, Web MIDI, service
      worker, polish + Lighthouse 90+, desktop layout, legal, Playwright, deploy.

Mic singing, more instruments and the Capacitor wrap come after Phase 8.
