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

**Phase 1 — Foundation: complete.** Next up is **Phase 2 — the sound and
music-theory engine** (`docs/SPEC.md` → "Prompt 2").

Phase 3 is the first point the app can actually train your ear; Phases 1–2 are
groundwork.

## Decisions made in Phase 1

- **Tailwind v4 with one token set.** Light values in `@theme`, dark re-bound
  under `[data-theme="dark"]`. No `dark:` variants in components.
- **`accent-strong` added to the palette.** The spec's `accent` fails 4.5:1
  behind white text (4.10:1); `#A65B44` fixes it at 4.88:1. See `docs/DESIGN.md`.
- **TypeScript pinned to 5.9.3**, because typescript-eslint rejects TS 7.
- **Four tabs only** (Learn, Practice, Play, Stats), per the spec. Home is `/`,
  reached via the wordmark; Settings via the avatar.
- **Contrast is enforced in CI** (`pnpm contrast`), not left to review.

## Open questions

- The dark palette is the spec's untested proposal. Now that it runs, does it
  need tuning? (Spec invites this.)
- The A3 mockup was described in prose, not supplied as an image — the Home
  screen is built from that description. Worth a visual diff against the real
  mockup before Phase 3 locks the drill layout.
- Sample sets (tonejs-instruments, Salamander Grand Piano) still need licence
  review before Phase 2 commits to them; credits go in `docs/CREDITS.md`.
- Zustand and TanStack Query are named in the spec but not yet installed — they
  arrive with Phase 3 (session state) and Phase 4 (server data).
