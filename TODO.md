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

## Phase 3 follow-ups — level starts + timing (done)

- [x] A level now starts with everything the previous level ended with (mastered
      degrees carry forward) plus that level's first new item, instead of
      resetting to two options. Level 6 no longer opens on `1` vs `♭2`.
- [x] Chromatic unlock order, easiest first: `♭7, ♭3, ♭6, #4, ♭2`
- [x] Minor keys carry the natural-minor re-voicings of what was mastered in
      major (`3→♭3`, `6→♭6`, `7→♭7`), then add the raised 7th and raised 6th —
      nine degrees, not twelve
- [x] Opening a level cold gets its starter set: `1`, `5` and the level's first
      new degree. Never two notes a half step apart.
- [x] `SkillProgress.unlockedChoices` stays a count; the _set_ it unlocks is
      derived in one place (`unlockedDegrees`) from level + count + whether the
      user earned their way in. `GeneratorSettings` now takes
      `unlockedChoiceIds` rather than a bare count.
- [x] Learn screen shows "X of Y answers unlocked · N carried forward" and
      explains both entry paths
- [x] Tests: no level opens with only two options a half step apart; every
      opening set spans at least a fifth; carried-forward degrees appear on the
      next level; the chromatic and minor unlock orders; cold-open starter sets
- [x] Timings checked by ear and kept: cadence gap ~0.55 s, auto-advance 1400 ms.
      Both are now `DrillSettings` fields (`cadenceGapMs`, `autoAdvanceMs`), and
      the cadence's own trailing silence was moved out so the gap lives in one
      place and the setting cannot lie about its value.
- [x] Split the Vitest config into `logic` (node) and `components` (jsdom)
      projects. 22 jsdom instances had started exhausting worker memory on
      Windows (`0xC00000FD`), failing a different file each run; the suite now
      runs in ~5 s instead of ~13 s.

## Phase 3 follow-ups — drill keyboard + locked-state polish (done)

- [x] Keyboard mapping rebuilt in `src/lib/modes/degreeShortcuts.ts`. A number
      key is the degree **as the current key writes it** (in minor, `3` is `♭3`),
      and Shift reaches the altered one — lowering in major, raising in minor.
      `⇧2` is always `♭2` and `⇧4` always `♯4`, since those slots only have one
      direction available. Both modes cover all twelve degrees, no collisions.
- [x] Reads `event.code`, not `event.key`: on most layouts Shift+3 arrives as
      `#`, so the digit is only recoverable from the physical key.
- [x] Pressing the key for a locked degree shakes that button instead of doing
      nothing silently (`--animate-shake`; the global reduced-motion block
      already neutralises it)
- [x] Shortcut shown in the corner of each unlocked button (`3`, `⇧3`); hint
      line now reads "Number = degree · Shift = altered · Space replays the
      note · C replays the cadence · Enter for next"
- [x] Locked buttons: no fill, dashed border, muted text, lock icon, genuinely
      `disabled`, `aria-disabled`, out of the tab order, labelled "♭2, Ra, locked"
- [x] Line under the grid: "3 of 12 unlocked — get 85% over 20 answers to
      unlock the next one" (only while something is locked)
- [x] Grid columns by answer count: 2–4 one row, 5–8 two rows of four, 9 as
      3×3, 12 as 4×3
- [x] Minor levels already ordered by pitch (`1 2 ♭3 4 5 ♭6 6 ♭7 7`) — now
      asserted rather than incidental
- [x] Tests: the key mapping in both modes (coverage, no collisions, round-trip,
      `b3`/`3` and `b7`/`7` distinguishable), plus a component test for the
      locked state, shortcut badges, grid columns and button order

### Carried into Phase 4

- [ ] The drill has been verified by test and by route smoke-check; the two
      timings are now confirmed by ear, but a full end-to-end session on the new
      level-start behaviour and keyboard mapping has not been played yet.
- [ ] The shortcut badges assume a physical keyboard. On touch they are noise —
      worth hiding below `sm:` alongside the hint line once there is a view on
      how it actually looks on a phone.
- [ ] `DEFAULT_DRILL_SETTINGS` hard-codes all five instruments, `autoAdvance`,
      `autoAdvanceMs` and `cadenceGapMs`. Phase 4's Settings page should own all
      four.
- [ ] `unlockedChoices` is stored per _mode_, not per level, so leaving a level
      and returning resets it to that level's starter count. Harmless now that
      the starter carries forward, but per-level storage would be more honest —
      and the spec's `skill_progress.unlocked_choices` column is already `json`.
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
