# Overtone — Build Plan & Claude Code Prompts

Oct 12, 2026 · @Micah John

## Summary

Overtone is a public ear-training app for musicians of every level. It is built as a Next.js web app on Vercel first, and structured so it can be wrapped for the App Store later. Its core is functional (scale-degree) training, with honest progress tracking and a daily challenge everyone shares.

| Decision | Locked choice |
| --- | --- |
| Name | Overtone |
| Audience | Public, beginner through advanced |
| Platform | Next.js + TypeScript web app (PWA) on Vercel; later wrapped with Capacitor for iOS/Android |
| Accounts + sync | Supabase (auth + Postgres), behind a data-layer interface so it can be swapped at App Store time |
| v1 training modes | Scale degrees (core), intervals, chord qualities + inversions, chord progressions, melodic dictation |
| Games | Daily challenge + streaks; async head-to-head challenges; leaderboards |
| Sound | Real recorded samples, several instruments, random octave |
| Onboarding | Skippable placement test that suggests a level; any level can be chosen at any time |
| Answer input | Tap buttons, on-screen piano and fretboard, MIDI keyboard; singing into the mic in v2 |
| Look | Style A layout (Space Grotesk + JetBrains Mono), cream + navy colors |
| Themes | Light and dark, following the system setting |
| Money | Free now; likely freemium later, so leave room for a paid tier |

Style mockups: [Ear Training App — Style Directions](https://claude.ai/artifact/HU6aXNb2ZRMYHvemjGKovn) (the locked one is A3 · Cream + navy).

## Design system

The light theme is your cream + navy palette exactly. The dark theme is a proposal that keeps the same warmth: it can be tuned once you see it running.

| Token | Role | Light | Dark (proposed) |
| --- | --- | --- | --- |
| `bg` | App background | #F7F3EA warm cream | #14171C |
| `surface` | Cards and panels | #FFFCF7 soft ivory | #1C2027 |
| `primary` | Buttons, headings, selected items, progress | #183153 deep navy | #8FB0DA (text on it: #14171C) |
| `accent` | Streak flame, daily label, combo, logo dot | #B8654B muted terracotta | #D98A6F |
| `text` | Body text | #292D33 dark charcoal | #EDE8DE |
| `muted` | Secondary text (darkened for 4.5:1 contrast) | #6B655C | #A39C90 |
| `border` | Borders, dividers | #DDD6CA warm gray | #2E333B |
| `track` | Empty progress bars, waveform | #E6DFD2 | #2A2F37 |
| `success` | Correct answer | #2F6B4A (tint #E7F0E8) | #5FB383 (tint #17291F) |
| `danger` | Wrong answer | #A8322D (tint #F6E4E1) | #E07A6E (tint #2C1B1A) |

- **Type:** Space Grotesk for UI and headings; JetBrains Mono for labels, levels, timers and stats.
- **Shape:** 14–20 px corner radius on cards and buttons; pill chips for context (key, instrument, question count).
- **Feedback:** never color alone. Correct gets a check icon and "3 — Mi", wrong gets an X and plays the right answer back.
- **Touch:** every target at least 44 px; the main play button is large and centered.
- **Motion:** short, subtle transitions; respect reduced-motion. A light haptic tap on answer when on mobile.
- **Screens to match:** the A3 Home and A3 Drill mockups are the reference for layout, spacing and hierarchy.

## Training method

Every mode follows the same research-backed loop: a short session, a few choices that grow as you master them, instant feedback that replays the right answer, and separate tests with no feedback that measure real skill.

**Rules every mode follows**

- **Sessions:** 20 questions by default (about 5 minutes); a daily goal nudges short daily practice over long sessions.
- **Adaptive choices:** a level starts with 2 very different options and adds one when the last 20 answers are at least 85% correct and the median answer time is under 3 seconds.
- **Feedback:** right or wrong, the app replays the target next to the reference (the tonic for scale degrees, the root for chords).
- **Listen mode:** a hands-free "just listen" mode plays labelled examples, because practice plus passive listening beat practice alone in a 2018 study.
- **Vary the sound:** rotate instrument and octave, and play a short noise or silence between questions so the last note can't be used as a reference.
- **Track speed and accuracy:** store both for every answer; mastery needs both.
- **Practice vs test:** practice shows feedback; a level test (about 15 questions, no feedback) unlocks the next level at 90% or better.
- **Spaced review:** items you miss come back sooner; mastered items come back less often (a simple Leitner box per item is enough for v1).
- **Blocked, then mixed:** new levels drill one thing; a "mixed review" session pulls from everything you have unlocked.

**Level ladders for v1**

| Mode | How a question works | Level ladder |
| --- | --- | --- |
| Scale degrees (core) | A cadence (I–IV–V–I) sets the key, then one note plays; name its degree | 1 vs 5 → add 3 → 1-3-5 + 6 → all 7 major degrees → two octaves → chromatic notes → minor keys → no cadence replay |
| Intervals | Two notes, rising, falling or together; name the interval | P5 vs P8 → add M3, P4 → all within an octave → falling → harmonic → compound |
| Chords | One chord plays; name its quality (later its inversion) | major vs minor → + diminished, augmented → 7th chords → inversions → extended chords |
| Progressions | A key is set, then 4 chords play; name each by Roman numeral | I–IV–V → + vi → + ii → common pop and rock patterns → minor keys and borrowed chords |
| Melodic dictation | A cadence sets the key, then a short melody plays; enter each note's degree, or play it on the piano or fretboard | 3 notes, steps only → 4–5 notes with skips → two octaves → rhythm added |

**Placement test (skippable)**

- About 3 minutes: 5 adaptive questions per mode, getting harder after each right answer.
- It suggests a starting level per mode; users can still open any level from the skill screen at any time.

**Daily challenge**

- Same 10 questions for every user that day, seeded from the date; one attempt; score = accuracy plus a speed bonus.
- Playing it keeps your streak; one "streak freeze" per week saves a missed day.

**Async head-to-head**

- You play a set; the app saves its seed and your score, then gives you a link to send a friend.
- Your friend plays the exact same questions later; both see the result. Leaderboards are daily, weekly, all-time and friends-only.

## Architecture and data model

The app keeps three things behind their own interfaces so they can change without a rewrite: the audio engine, the question generators, and the data layer (Supabase today, possibly something else at App Store time).

**Stack**

- **App:** Next.js (App Router) + TypeScript, Tailwind CSS with the design tokens as CSS variables, `next-themes` for light/dark.
- **State:** Zustand for the live session; TanStack Query for server data.
- **Audio:** Tone.js `Sampler` per instrument, samples lazy-loaded and cached by the service worker. Candidate free sample sets: [tonejs-instruments](https://github.com/nbrosowsky/tonejs-instruments) and the Salamander Grand Piano — check each license and credit them on an About screen.
- **Music logic:** `tonal` for notes, intervals, scales and chords; all question generation is pure TypeScript, seeded so the same seed gives the same questions.
- **Input:** answer buttons, an SVG piano and fretboard, Web MIDI (Chrome, Edge and Android only — hide it where unsupported, including iOS).
- **Backend:** Supabase Auth (email magic link + Google + Apple later), Postgres with row-level security, Edge Functions for daily-challenge scoring and leaderboards.
- **PWA:** `@serwist/next` service worker, installable manifest, offline practice with answers queued and synced when back online.
- **Mobile later:** wrap the same build with Capacitor; swap web push and in-app purchases then. Audio must start from a user tap (iOS rule), so the first play button unlocks the audio context.
- **Quality:** Vitest for music logic and generators, Playwright for the main flows, ESLint + Prettier, GitHub Actions on every PR.

**Folder layout**

```
src/
  app/            routes: (marketing), learn, practice, play, stats, challenge/[id], auth
  components/     ui/ (design-system pieces), drill/, instruments/ (Piano, Fretboard)
  lib/audio/      AudioEngine interface + ToneAudioEngine
  lib/theory/     notes, scales, cadences (wraps tonal)
  lib/modes/      one generator per mode: scaleDegrees, intervals, chords, progressions, dictation
  lib/learning/   adaptive levels, Leitner review, mastery rules, placement test
  lib/data/       DataStore interface + SupabaseStore + LocalStore (offline / signed-out)
  lib/midi/       Web MIDI input
supabase/         migrations, seed, edge functions
docs/             SPEC.md (this plan), DESIGN.md (tokens)
```

**Database tables (Supabase Postgres, all with row-level security)**

| Table | Holds | Key columns |
| --- | --- | --- |
| `profiles` | One row per user | id (auth user), username, display\_name, plan (`free`/`pro`), settings (json), created\_at |
| `skill_progress` | Level and mastery per user per mode | user\_id, mode, level, unlocked\_choices (json), mastery, updated\_at |
| `sessions` | One practice, test or game run | id, user\_id, mode, level, kind (`practice`/`test`/`daily`/`challenge`/`placement`), seed, score, accuracy, median\_ms, started\_at, ended\_at |
| `answers` | Every question answered | session\_id, user\_id, item\_key, correct, response\_ms, instrument, octave, answered\_at |
| `item_stats` | Spaced-review state per item | user\_id, mode, item\_key, box, due\_at, seen, correct |
| `streaks` | Daily streak | user\_id, current, best, last\_active\_date, freezes\_left |
| `daily_challenges` | Today's shared set | date, mode, level, seed |
| `daily_results` | One attempt per user per day | date, user\_id, score, accuracy, median\_ms |
| `challenges` | Async head-to-head | id, creator\_id, mode, level, seed, creator\_score, expires\_at |
| `challenge_results` | Friend's attempt | challenge\_id, user\_id, score, accuracy, median\_ms |
| `friendships` | Friends list | user\_id, friend\_id, status (`pending`/`accepted`) |

Leaderboards are Postgres views over `daily_results` and `sessions`; scores are computed server-side from stored answers, so a tampered client can't post a fake score.

**Freemium-ready:** every feature checks `can(user, feature)` against `profiles.plan`. In v1 everything returns true; a paid tier is a one-line change per feature later.

## Roadmap

Overtone is built in 8 phases, one Claude Code prompt per phase, and you test the app at the end of each one before starting the next.

&#91;embedded content: Overtone roadmap · 8 phases, one Claude Code prompt each\]

Phase 3 is the first point where you can actually train your ear in the app; everything before it is groundwork, everything after it builds on that loop. Mic singing, more instruments and the App Store wrap come after phase 8.

## Claude Code prompts

Run these in order, one per Claude Code session, and test the app between each. They all point back to the spec, so Claude Code always works from the same plan.

**Before Prompt 1**

- [ ] Make an empty folder `overtone` and a GitHub repo for it.
- [ ] Export this doc as Markdown and save it as `overtone/docs/SPEC.md`.
- [ ] Create a free Supabase project (needed from Prompt 4) and keep its URL and anon key handy.
- [ ] Open Claude Code in the `overtone` folder.

### Prompt 1 — Foundation

```text
You are building Overtone, an ear-training web app for musicians. The full plan is in docs/SPEC.md — read all of it before doing anything, and treat it as the source of truth.

This session is Phase 1: Foundation. Do only this phase.

1. Create CLAUDE.md at the repo root. Summarize SPEC.md for future sessions: what Overtone is, the stack, the folder layout, the design tokens, the coding rules below, and a "Phase status" checklist of the 8 phases from the Roadmap section. Keep it under 150 lines.
2. Scaffold a Next.js (App Router) + TypeScript project with pnpm, Tailwind CSS, ESLint, Prettier and Vitest. Use the folder layout from the spec's "Folder layout" block.
3. Create docs/DESIGN.md and implement the design tokens from the spec's Design system table as CSS variables (light values on :root, dark values under [data-theme="dark"]) and map them into the Tailwind theme (bg, surface, primary, accent, text, muted, border, track, success, danger). Use next-themes so the theme follows the system setting, with a manual override in Settings.
4. Load Space Grotesk and JetBrains Mono with next/font.
5. Build the base UI components in src/components/ui: Button (primary, outline, ghost), Card, Chip, ProgressBar, StatPill, IconButton, and a bottom TabBar with four tabs: Learn, Practice, Play, Stats. Every touch target must be at least 44px. Use simple inline SVG icons, no emoji.
6. Build the app shell and a Home screen that matches the "A3 · Cream + navy — Home" mockup described in the spec: header with the "overtone." wordmark (terracotta dot), streak pill and avatar; greeting; Daily Challenge card; "Your skills" list with level and progress bars; a friend-challenge row; the tab bar. Use placeholder data from a single mock file for now.
7. Add empty placeholder pages for Learn, Practice, Play, Stats and Settings so every tab works.
8. Add a GitHub Actions workflow that runs lint, typecheck and tests on every push.

Rules for the whole project:
- TypeScript strict mode; no `any`.
- Mobile first (390px wide) and must also look right on desktop (center the app at a max width of about 480px for now).
- Accessible: real buttons and links, labels on icon buttons, text contrast at least 4.5:1, respect prefers-reduced-motion.
- Keep music logic, audio and data access out of components — they live in src/lib.

When done: run lint, typecheck and tests, start the dev server, and tell me the URL plus what I should click to check it in both light and dark mode. Update the Phase status in CLAUDE.md. Then stop.
```

### Prompt 2 — Sound and music theory engine

```text
Read CLAUDE.md and docs/SPEC.md. This session is Phase 2: the sound and music-theory engine. No new screens except a small test page.

1. Audio (src/lib/audio):
   - Define an AudioEngine interface: unlock(), loadInstrument(id), playNote(note, duration, when?), playChord(notes, duration, when?), playSequence(events), playNoiseBurst(ms), stopAll(), setVolume(v).
   - Implement ToneAudioEngine with Tone.js Sampler. Support at least: piano, acoustic guitar, electric guitar (clean), cello, flute. Use free, properly licensed sample sets (look at tonejs-instruments and the Salamander Grand Piano), load only the samples needed, and lazy-load each instrument the first time it's used.
   - Put the sample files in public/samples/<instrument>/ and record each source and license in docs/CREDITS.md.
   - Audio must be unlocked by the first user tap (iOS requires this).
2. Theory (src/lib/theory), using the `tonal` package:
   - Helpers for keys, scale degrees (major and natural minor, plus chromatic degrees like b3, #4, b7), intervals, chord qualities and inversions, and Roman-numeral progressions.
   - A cadence builder that returns the notes of I–IV–V–I in any key, voiced in a comfortable range.
3. Seeded randomness: a small seeded RNG (e.g. mulberry32) so the same seed always produces the same questions. Generators must never use Math.random directly.
4. Question generator contract (src/lib/modes/types.ts): a Generator takes { seed, level, settings } and returns Question objects with: id, mode, prompt text, the audio events to play, the reference audio events (cadence/tonic/root), the answer choices, the correct answer, and an itemKey for spaced review. Include the "vary the sound" rule from the spec: random instrument from the user's allowed set, random octave within a safe range, and a noise burst or 1.5s silence between questions.
5. Write thorough Vitest tests for theory helpers, the RNG and the generator contract (same seed = same questions; notes always in range).
6. Add a hidden /dev/sound page where I can pick an instrument, a key, play the cadence, play each scale degree, and play a chord, so I can hear that everything sounds right.

When done: run all tests, then tell me how to open /dev/sound and what to listen for. Update the Phase status in CLAUDE.md. Then stop.
```

### Prompt 3 — The core scale-degree drill

```text
Read CLAUDE.md and docs/SPEC.md (especially "Training method"). This session is Phase 3: the core scale-degree drill, the heart of the app. Everything stays local for now (no accounts yet) — save progress through a DataStore interface with a LocalStore implementation (IndexedDB via idb-keyval) so Supabase can be plugged in next phase.

1. Scale-degree generator (src/lib/modes/scaleDegrees.ts) following the spec's level ladder: 1 vs 5 → add 3 → 1-3-5 + 6 → all 7 major degrees → two octaves → chromatic notes → minor keys → no cadence replay. Each question plays the cadence, then the target note.
2. Learning engine (src/lib/learning):
   - Adaptive choices: a level starts with its first 2 options and adds the next one when the last 20 answers are at least 85% correct with a median answer time under 3 seconds.
   - Leitner spaced review per itemKey (5 boxes); missed items come back sooner.
   - Level tests: about 15 questions, no feedback, pass at 90% to unlock the next level.
   - Record every answer: itemKey, correct, response time in ms, instrument, octave.
3. Drill screen matching the "A3 · Cream + navy — Scale-degree drill" mockup: close button, progress bar, combo counter; context chips (key, instrument, question n/20); a large round play button that replays the note; a "Replay cadence" button; the question "Which scale degree is that?"; a 4-column grid of degree buttons 1–7 with solfège under each number, locked ones dimmed; a feedback bar at the bottom.
4. Feedback: on a correct answer, show a check, "3 — Mi", the time taken and a one-line description of that degree's feel, then auto-advance after a short pause (setting to turn off). On a wrong answer, show an X and play the correct note next to the tonic so the difference is audible. Never rely on color alone.
5. Keyboard shortcuts on desktop: 1–7 answer, space replays the note, C replays the cadence, Enter = next.
6. Session summary screen: accuracy, median time, best combo, which degrees were weakest, and buttons for "Practice again" and "Take level test".
7. A "Listen" mode: hands-free, plays the cadence and then labelled degrees with the label shown, for passive exposure.
8. Learn tab: shows the scale-degree skill with its levels (locked/unlocked/mastered); any level can be opened manually.
9. Hook the Home screen's "Your skills" list to the real saved progress for this mode.

Write tests for the adaptive rules, Leitner scheduling and the scale-degree generator. When done: run tests, start the dev server, and give me a 2-minute script of what to try. Update the Phase status in CLAUDE.md. Then stop.
```

### Prompt 4 — Accounts and synced progress

```text
Read CLAUDE.md and docs/SPEC.md (especially "Architecture and data model"). This session is Phase 4: Supabase accounts and synced progress.

My Supabase project URL and anon key will go in .env.local as NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY — ask me for them when you need them, and make sure .env.local is in .gitignore. Never put the service-role key in client code.

1. Set up the Supabase CLI with a supabase/ folder and write migrations for every table in the spec's "Database tables" list (profiles, skill_progress, sessions, answers, item_stats, streaks, daily_challenges, daily_results, challenges, challenge_results, friendships) with sensible indexes.
2. Row-level security on every table: users can read and write only their own rows; daily_challenges is readable by everyone; challenges are readable by anyone with the id. Write SQL tests or a script that proves one user can't read another user's answers.
3. Auth with @supabase/ssr: email magic link and Google sign-in. Pick a username on first sign-in (unique, 3–20 characters). A profile row is created by a database trigger.
4. SupabaseStore implements the same DataStore interface as LocalStore. Signed-out users keep using LocalStore; when they sign in, offer to merge local progress into their account (no data loss, no duplicates).
5. Offline: answers recorded while offline are queued and synced when the connection returns.
6. Add `can(user, feature)` in src/lib/entitlements.ts that reads profiles.plan; for now it always returns true. Use it at the entry to each mode so a paid tier is easy later.
7. Settings page: account info, sign out, theme, auto-advance, instruments allowed in drills, and delete account (deletes all their data).

When done: list the exact commands I need to run to apply the migrations, tell me how to test sign-in and syncing across two browsers, and update the Phase status in CLAUDE.md. Then stop.
```

### Prompt 5 — Intervals, chords, progressions, dictation + instruments

```text
Read CLAUDE.md and docs/SPEC.md ("Training method" → "Level ladders for v1"). This session is Phase 5: the other four training modes and the on-screen instruments. Reuse the drill screen, learning engine and DataStore from Phase 3 — don't build a second drill system. Generalize the drill screen so each mode just supplies its generator, answer layout and feedback text.

1. Intervals generator: rising, falling and harmonic; ladder P5 vs P8 → add M3, P4 → all within an octave → falling → harmonic → compound. Feedback plays both notes again, then together.
2. Chords generator: ladder major vs minor → + diminished, augmented → 7th chords (maj7, 7, m7, m7b5) → inversions → extended chords. Feedback replays the chord, then arpeggiates it.
3. Progressions generator: key set by a cadence, then 4 chords; the user fills 4 slots with Roman numerals. Ladder I–IV–V → + vi → + ii → common pop/rock patterns → minor keys and borrowed chords. Score each slot; feedback replays the progression with numerals shown in time.
4. Melodic dictation generator: cadence, then a short melody; ladder 3 notes by step → 4–5 notes with skips → two octaves → rhythm added. The user enters each note by degree buttons OR on the piano or fretboard. Feedback shows their answer against the correct one note by note and lets them replay any single note.
5. Instruments (src/components/instruments):
   - Piano: one or two octaves, SVG, labels can show scale degrees, solfège, note names or nothing (setting). Tapping a key plays it.
   - Fretboard: 6 strings, frets 0–12, standard tuning, SVG, same label options, highlights correct/wrong positions. Tapping plays the note with the guitar sample.
   - Both work with mouse, touch and keyboard, and report the note played to the drill.
6. Every mode can be answered by tapping buttons; scale degrees and dictation can also be answered on the piano or fretboard (user picks in the drill).
7. Add all modes to the Learn tab and the Home skills list, and add a "Mixed review" session in Practice that pulls due items from every unlocked mode.

Tests for every generator (seeded, in range, correct answers). When done: start the dev server and give me a short script to try each mode. Update the Phase status in CLAUDE.md. Then stop.
```

### Prompt 6 — Placement test, daily challenge and streaks

```text
Read CLAUDE.md and docs/SPEC.md ("Placement test" and "Daily challenge"). This session is Phase 6.

1. Onboarding: first launch shows a short welcome (what Overtone trains, 3 screens max), asks the user's instrument and rough experience, then offers the placement test with a clear "Skip" button.
2. Placement test: about 3 minutes, 5 adaptive questions per mode (harder after each correct answer, easier after a miss). Results screen suggests a starting level per mode with a one-line reason; the user can accept or change any of them. It can be retaken from Settings, and any level can always be opened manually from the Learn tab.
3. Daily challenge:
   - A Supabase Edge Function (or scheduled job) creates one daily_challenges row per UTC date with a mode, level and seed; rotate the mode across days.
   - Everyone gets the same 10 questions (same seed). One attempt per user per day.
   - Score = accuracy plus a speed bonus; compute it on the server from the submitted answers, never trust a score sent from the client.
   - Results screen shows score, rank for today, and a share button with a text summary (no spoilers of the answers).
   - Signed-out users can play but must sign in to post a score.
4. Streaks: completing the daily challenge or a full practice session counts for the day (in the user's local time zone). Track current and best streak. One streak freeze per week, used automatically on a missed day.
5. Hook the Home screen's Daily Challenge card (time left until reset, play button, done state) and streak pill to real data.
6. Notifications: a gentle opt-in daily reminder using web push (only after the user has finished at least one session). Keep this behind a setting.

Tests for placement scoring, streak date logic (time zones, freezes) and the daily seed. When done: tell me how to test a full day cycle locally. Update the Phase status in CLAUDE.md. Then stop.
```

### Prompt 7 — Async challenges, friends and leaderboards

```text
Read CLAUDE.md and docs/SPEC.md ("Async head-to-head"). This session is Phase 7: social features. All require sign-in.

1. Challenges: after any practice session or from the Play tab, the user can "Challenge a friend". This saves a challenges row (mode, level, seed, the creator's score) and gives a share link /challenge/[id] plus a native share sheet.
2. Opening the link shows who sent it, the mode, and the score to beat; signed-out visitors are asked to sign in first and then land back on it. The friend plays the exact same questions; the result screen shows both players side by side (accuracy, median time, score) and offers a rematch.
3. Scores are computed server-side from submitted answers. Each user gets one attempt per challenge. Challenges expire after 7 days.
4. Friends: add a friend by username or by accepting a challenge from them; pending/accept/remove. A Play tab section lists open challenges (to play, waiting on them, finished).
5. Leaderboards: daily challenge (today), weekly (sum of daily scores), all-time, and a friends-only filter. Build them as Postgres views or RPC functions with pagination; show the user's own rank even if they're not in the top 50.
6. Privacy: usernames only, never emails. Users can hide themselves from global leaderboards in Settings. Add a basic report button on usernames and a profanity filter on username creation.
7. Make sure row-level security still prevents reading other users' raw answers; leaderboards expose only username, score and rank.

When done: tell me how to test a challenge end to end with two accounts (two browsers). Update the Phase status in CLAUDE.md. Then stop.
```

### Prompt 8 — Stats, MIDI, PWA polish and launch

```text
Read CLAUDE.md and docs/SPEC.md. This session is Phase 8: the last v1 phase — stats, MIDI input, installable app, polish and deploy.

1. Stats tab: accuracy over time per mode (line chart), median answer time trend, a 12-week activity heatmap, weakest items per mode (e.g. "b7 vs 6", "m3 vs M3") with a "Practice these" button that starts a session of just those items, and streak history. Use the design tokens for chart colors and make the charts readable in both themes.
2. MIDI: Web MIDI input in src/lib/midi; a Settings section to pick a device; playing a note on a MIDI keyboard answers dictation and scale-degree questions. Only show MIDI options where navigator.requestMIDIAccess exists (hide on iOS).
3. PWA: installable manifest (name Overtone, cream background, navy theme color, proper icons), a service worker with @serwist/next that caches the app shell and the instrument samples, and an offline practice mode using LocalStore plus the sync queue.
4. Polish pass: loading and empty states everywhere, error boundaries, sound-loading indicator, haptic tap on answers where supported, reduced-motion support, focus order and screen-reader labels checked on every screen, and Lighthouse scores of 90+ for performance, accessibility and best practices on the Home and Drill pages.
5. Desktop layout: two columns on wide screens (drill on the left, piano/fretboard or session stats on the right) instead of a stretched phone layout.
6. Legal and credits: an About page with sample credits from docs/CREDITS.md, a privacy policy page (what's stored, how to delete it) and terms.
7. Playwright end-to-end tests for: first launch → skip placement → complete a scale-degree session; sign in → progress synced; daily challenge; creating and answering a challenge.
8. Deploy: set up the Vercel project, environment variables and Supabase production settings (auth redirect URLs for the production domain). Write docs/DEPLOY.md with every step.
9. Write docs/NEXT.md listing v2 ideas from the spec: singing into the mic with pitch detection, more instruments, the Capacitor wrap for the App Store, and the freemium tier.

When done: give me a launch checklist of things I need to do myself (domain, Supabase production keys, Google OAuth setup) and update the Phase status in CLAUDE.md to show v1 complete.
```

**If something breaks between phases:** start a fresh Claude Code session with "Read CLAUDE.md and docs/SPEC.md. In Phase N, \<what happened>. Find the cause, fix it, add a test that would have caught it, and tell me what changed."

## Sources

- [Ear training — Wikipedia](https://en.wikipedia.org/wiki/Ear_training)
- [Van Hedger et al. 2019, Absolute pitch can be learned by some adults](https://pmc.ncbi.nlm.nih.gov/articles/PMC6759182)
- [ScienceDaily: University of Surrey 2025 absolute pitch study](https://sciencedaily.com/releases/2025/02/250212134435.htm)
- [Psychonomic Society: practice plus exposure in interval training (Little, Cheng & Wright 2018)](https://featuredcontent.psychonomic.org/perfect-unison-or-perfect-fourth-practice-makes-perfect-only-with-exposure-during-musical-interval-training/)
- [ToneDear exercise types (functional ear training)](https://tonedear.com/)
- [Functional Ear Trainer](https://apps.apple.com/app/id1088761926)
