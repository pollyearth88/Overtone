# Plan

The full architecture and roadmap live in **[docs/SPEC.md](./docs/SPEC.md)** —
this file only tracks where we are and what is still unresolved. Don't duplicate
the spec here.

## Goal

An ear-training app anyone can use, whose core is functional (scale-degree)
training. Honest progress tracking, a shared daily challenge, async head-to-head.
Web first on Vercel; the same build wraps for iOS/Android later.

## Architecture in one line

Next.js App Router + Tailwind tokens for the UI; three swappable interfaces
underneath — `AudioEngine`, question `Generator`s, and `DataStore` — so audio,
music logic and persistence can each change without a rewrite.

## Current phase

**Phase 3 — The core scale-degree drill: complete.** The app now actually trains
your ear: eight levels, adaptive choices, spaced review, level tests, feedback,
a session summary and Listen mode, all persisted locally.

Next up is **Phase 4 — accounts and synced progress** (`docs/SPEC.md` →
"Prompt 4"): Supabase migrations with RLS, auth, `SupabaseStore` behind the same
`DataStore` interface, local→account merge, an offline queue, and Settings.

## Decisions made in Phase 1

- **Tailwind v4 with one token set.** Light values in `@theme`, dark re-bound
  under `[data-theme="dark"]`. No `dark:` variants in components.
- **`accent-strong` added to the palette.** The spec's `accent` fails 4.5:1
  behind white text (4.10:1); `#A65B44` fixes it at 4.88:1. See `docs/DESIGN.md`.
- **TypeScript pinned to 5.9.3**, because typescript-eslint rejects TS 7.
- **Four tabs only** (Learn, Practice, Play, Stats), per the spec. Home is `/`,
  reached via the wordmark; Settings via the avatar.
- **Contrast is enforced in CI** (`pnpm contrast`), not left to review.

## Decisions made in Phase 2

- **The cadence does not rotate instruments.** A voiced I–IV–V–I spans about two
  octaves; no single-octave sample set holds that, so the key reference always
  plays on piano and only the question rotates. This is also what printed
  functional-ear-training material does, and it keeps the reference timbrally
  constant so only the question's colour changes.
- **Minor cadences use a major V** (`i–iv–V–i`). Natural minor's own `v` leaves
  the key ambiguous; the raised third is what makes the ear commit.
- **Instruments declare a `range` narrower than their samples could stretch to**,
  and generation refuses to place a note outside it. Past ~3 semitones of
  pitch-shift the timbre changes audibly, which in an ear trainer is a cue the
  user could learn _instead of_ the pitch.
- **Voice leading is computed, not tabulated.** `voicing.ts` keeps upper voices
  in a fixed octave window and picks the inversion that moves least. That
  reproduces the textbook I–IV–V–I without special cases, and generalises to the
  Phase 5 progression mode for free.
- **`tonal` pinned to 6.4.3** plus three transitive `overrides` — the 6.5.0
  releases are unresolvable by any bundler. See the gotcha in `CLAUDE.md`.
- **Samples are manifest-driven.** `instruments.ts` is the source of truth for
  both the downloader and the `Sampler` URLs, and a test fails if a declared
  sample is missing from disk — a missing file would otherwise be a silent 404
  and an instrument that never loads.

## Decisions made in Phase 3

- **The learning engine is pure and separate from the session.** `lib/learning`
  holds one file per rule (`adaptive`, `leitner`, `mastery`) plus `progress` to
  compose them; `lib/session/drillStore` sequences a session but decides nothing
  about progression. That split is why the rules are cheap to test.
- **`LocalStore` mirrors the spec's Postgres tables field for field**, ISO
  strings and all, so Phase 4's `SupabaseStore` is a transport change rather
  than a data-model change.
- **Allowed instruments are a preference, not a constraint.** Restricting the
  drill to the flute and opening the two-octave level is unsatisfiable, so
  `rollVoicing` substitutes a wider instrument instead of throwing.
- **A level test never costs anything.** Failing changes nothing — no demotion,
  no lost choices. A bad test is information, and it can be retaken.
- **Moving level resets earned choices** to the starting two, because the answer
  set is genuinely different: earning all seven major degrees says nothing about
  readiness for all twelve chromatic ones.
- **Level 8 keeps `reference` populated** and flags `autoPlayReference: false`.
  The level withholds the cadence from automatic playback, not from a user who
  presses Replay.
- **The drill runs in a `FocusLayer`** that covers the tab bar, rather than
  restructuring Phase 1's root layout into route groups. Revisit in Phase 8.

## Open questions

- The dark palette is the spec's untested proposal. Now that it runs, does it
  need tuning? (Spec invites this.)
- The A3 mockup was described in prose, not supplied as an image — the Home
  screen is built from that description. Worth a visual diff against the real
  mockup before Phase 3 locks the drill layout.
- Zustand and TanStack Query are named in the spec but not yet installed — they
  arrive with Phase 3 (session state) and Phase 4 (server data).
- The audio engine has been verified by test and by eye, **but not yet by ear**.
  The per-instrument `gainDb` trims and the cadence tempo are first guesses;
  `/dev/sound` is there to correct them.
- 6.6 MB of samples sit in the repo, lazy-loaded 1–2 MB per instrument. Fine on
  wifi; Phase 8's service worker decides whether it is fine on mobile data.

Resolved in Phase 2: the sample-set licence review (all CC BY 3.0 via
tonejs-instruments — see `docs/CREDITS.md`, which also records why Salamander
was considered and not used).
