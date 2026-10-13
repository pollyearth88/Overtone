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

## Phase 2 — Sound and music-theory engine (done)

- [x] `AudioEngine` interface in `src/lib/audio`
- [x] `ToneAudioEngine` with Tone.js `Sampler`; piano, acoustic + electric
      guitar, cello, flute; lazy-load per instrument
- [x] Source and licence-check free samples → `public/samples/<instrument>/`,
      record each in `docs/CREDITS.md` (49 files, 6.6 MB, CC BY 3.0)
- [x] Unlock audio on first user tap (iOS)
- [x] `src/lib/theory` on `tonal`: keys, scale degrees (incl. b3/#4/b7),
      intervals, chord qualities + inversions, Roman numerals
- [x] Cadence builder: I–IV–V–I in any key, comfortable voicing
      (i–iv–**V**–i in minor; voice-leading voicer in `voicing.ts`)
- [x] Seeded RNG (mulberry32) — generators never touch `Math.random`
- [x] `src/lib/modes/types.ts` generator contract + the "vary the sound" rule
- [x] Vitest coverage: theory helpers, RNG, same seed = same questions, range
      — 289 tests across 15 files
- [x] Hidden `/dev/sound` page to audition instruments, cadences, degrees, chords
- [x] Manifest-driven `pnpm samples` downloader, so `instruments.ts` and the
      files on disk can't drift; a test fails if a declared sample is missing
- [x] Work around the broken `tonal` 6.5.0 packaging (pins + `pnpm tonal:check`)

### Carried into Phase 3

- [x] `src/lib/modes/reference.ts` replaced by the real `scaleDegrees.ts` and
      deleted; its contract tests moved onto the new generator.
- [ ] Listen for whether the per-instrument `gainDb` trims are actually matched
      once heard on real speakers; they were set by eye, not by ear.
- [ ] Decide whether the flute's 5-semitone E–A sample gap is audible enough to
      matter (it is the thinnest set upstream; nothing better is free).

## Phase 3 — The core scale-degree drill (done)

- [x] `scaleDegrees.ts` with the spec's full 8-rung ladder: 1 vs 5 → +3 →
      1-3-5+6 → all 7 → two octaves → chromatic → minor keys → no cadence replay
- [x] `lib/learning/adaptive.ts` — 2 choices, +1 at ≥85% and median <3 s over 20
- [x] `lib/learning/leitner.ts` — 5 boxes, miss resets to box 1, box 1 returns
      inside the same session
- [x] `lib/learning/mastery.ts` — 15-question tests, pass at 90% (14/15),
      session scoring, weakest-item breakdown with confusions
- [x] `lib/learning/progress.ts` — composes the three rules onto stored progress
- [x] `DataStore` interface + `LocalStore` on IndexedDB (idb-keyval), shaped to
      mirror the spec's Postgres tables so Phase 4 is a transport swap
- [x] `lib/session/drillStore.ts` — the live Zustand session
- [x] Drill screen: close, progress, combo, context chips, round play button,
      Replay cadence, 4-column degree grid with solfège, locked ones dimmed
- [x] Feedback: check/X + icon + text (never colour alone), degree + solfège,
      time taken, the degree's "feel" line, auto-advance on correct (switchable),
      wrong answers play the tonic next to the target
- [x] Keyboard shortcuts: 1–7 answer, space replays note, C replays cadence,
      Enter next
- [x] Session summary: accuracy, median, best combo, weakest degrees with what
      they were confused with, Practice again / Take level test
- [x] Listen mode — hands-free labelled exposure, label shown before the note
- [x] Learn tab with the level ladder (locked/current/mastered, any level openable)
- [x] Practice tab entry point showing what is due for review
- [x] Home "Your skills" reads real saved progress for scale degrees
- [x] Tests: adaptive rules, Leitner scheduling, mastery/scoring, progress
      composition, the generator, `LocalStore`, and the session flow — 489 total

### Carried into Phase 4

- [ ] The drill has been verified by test and by route smoke-check, **not yet by
      ear end-to-end** — play a full session and check the audio timing feels right.
- [ ] `DEFAULT_DRILL_SETTINGS` hard-codes all five instruments and
      `autoAdvance: true`. Phase 4's Settings page should own these.
- [ ] Streak, daily challenge and friend-challenge rows on Home are still mock
      (`src/lib/mock/home.ts`) — Phases 6 and 7.
- [ ] `levelProgress` caps at 70% until the level test is passed. Worth a look
      once there is real usage: it may read as "stuck" to someone who has
      unlocked every choice.

## Carried over / nice to have

- [x] Add a real GitHub remote and push — <https://github.com/pollyearth88/Overtone>
      (note the capital O; it was created pre-flight). CI green on first run.
- [ ] CI annotations to tidy eventually: `pnpm/action-setup@v4` still targets
      Node 20 (deprecated, forced onto 24), and `ubuntu-latest` migrates to
      Ubuntu 26 on 19 Oct 2026. Both are warnings, not failures.
- [ ] Tune the dark palette once it has been looked at properly
- [ ] Visual diff of the Home screen against the actual A3 mockup
- [ ] Favicon and PWA icons (full manifest lands in Phase 8)
