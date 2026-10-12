# TODO

Phase status lives in `CLAUDE.md`. This is the task-level view.

## Phase 1 — Foundation (done)

- [x] Move the build plan to `docs/SPEC.md` (it was loose at the repo root)
- [x] `CLAUDE.md` — spec summary, stack, layout, tokens, rules, phase checklist
- [x] Scaffold Next.js 16 App Router + TypeScript with pnpm
- [x] Tailwind v4, ESLint (flat config), Prettier, Vitest
- [x] `docs/DESIGN.md` + tokens as CSS variables, mapped into the Tailwind theme
- [x] `next-themes` following the system setting, manual override in Settings
- [x] Space Grotesk + JetBrains Mono via `next/font`
- [x] Base UI: Button, Card, Chip, ProgressBar, StatPill, IconButton, TabBar
- [x] Inline SVG icon set (no emoji)
- [x] App shell — 390px mobile first, centred at 480px on desktop
- [x] Home screen: header + wordmark, streak pill, avatar, greeting, Daily
      Challenge card, Your skills list, friend-challenge row, tab bar
- [x] Single mock data file (`src/lib/mock/home.ts`)
- [x] Placeholder pages: Learn, Practice, Play, Stats, Settings
- [x] GitHub Actions running lint, format, typecheck, test, contrast
- [x] Contrast checker + fix the two failing token pairs
- [x] Spec folder layout stubbed out for later phases
- [x] Verify light and dark both render

## Phase 2 — Sound and music-theory engine (next)

- [ ] `AudioEngine` interface in `src/lib/audio`
- [ ] `ToneAudioEngine` with Tone.js `Sampler`; piano, acoustic + electric
      guitar, cello, flute; lazy-load per instrument
- [ ] Source and licence-check free samples → `public/samples/<instrument>/`,
      record each in `docs/CREDITS.md`
- [ ] Unlock audio on first user tap (iOS)
- [ ] `src/lib/theory` on `tonal`: keys, scale degrees (incl. b3/#4/b7),
      intervals, chord qualities + inversions, Roman numerals
- [ ] Cadence builder: I–IV–V–I in any key, comfortable voicing
- [ ] Seeded RNG (mulberry32) — generators never touch `Math.random`
- [ ] `src/lib/modes/types.ts` generator contract + the "vary the sound" rule
- [ ] Vitest coverage: theory helpers, RNG, same seed = same questions, range
- [ ] Hidden `/dev/sound` page to audition instruments, cadences, degrees, chords

## Carried over / nice to have

- [ ] Add a real GitHub remote and push (repo is local-only so far)
- [ ] Tune the dark palette once it has been looked at properly
- [ ] Visual diff of the Home screen against the actual A3 mockup
- [ ] Favicon and PWA icons (full manifest lands in Phase 8)
