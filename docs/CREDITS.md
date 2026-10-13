# Credits

Everything Overtone ships that someone else made, and the terms it comes under.
The About page (Phase 8) renders this list in the app, which is what satisfies
the attribution requirements below.

## Instrument samples

All five instrument sample sets come from **[tonejs-instruments][tji]** by Nick
Brosowsky, which collects public-domain and permissively licensed orchestral
samples and edits them for consistency — trimmed silence, on/off ramps,
volume-matching, normalising, noise removal and some pitch correction.

- **Samples licence: [CC BY 3.0][ccby3]** (as stated by the tonejs-instruments
  repository for all of its samples).
- Repository code licence: MIT (not used here — we only take the audio).
- Attribution required: Nick Brosowsky / tonejs-instruments, plus the upstream
  source of each set below.

| Instrument in Overtone | Upstream source                                         | Files |
| ---------------------- | ------------------------------------------------------- | ----: |
| Piano                  | [Versilian Studios Chamber Orchestra 2][vsco] (VSCO2)   |    10 |
| Acoustic guitar        | [University of Iowa Electronic Music Studios][iowa]     |     9 |
| Electric guitar        | [Karoryfer Samples][karo]                               |    13 |
| Cello                  | [Freesound][fs] — `12408__flcellogrl__real-cello-notes` |    10 |
| Flute                  | [Versilian Studios Chamber Orchestra 2][vsco] (VSCO2)   |     7 |

Upstream per-set terms, for the record: VSCO2 Community Edition is released
CC0; the Iowa samples are published for free use with attribution; the Karoryfer
and Freesound material is permissively licensed by its uploaders. CC BY 3.0 is
the strictest of these, so crediting everything under CC BY 3.0 — as this file
does — satisfies all of them.

### Which samples, and why those

`src/lib/audio/instruments.ts` is the manifest: it names every sampled pitch and
the range each instrument is allowed to play. `scripts/fetch-samples.mjs` reads
it and downloads exactly those files into `public/samples/<instrument>/`, so the
manifest and the files on disk cannot drift apart. `instruments.test.ts` fails if
a declared sample is missing from disk.

Two constraints set the sample lists:

- **Samples sit no more than ~3 semitones apart**, because past that
  `Tone.Sampler`'s pitch-shifting changes the timbre audibly — and in an ear
  trainer a timbre cue is something the user could learn _instead of_ the pitch.
  Most sets are sampled in major or minor thirds; the flute set is the thinnest
  upstream (C/E/A only) and sets the worst case at 5 semitones between E and A.
- **Each instrument declares a narrower `range` than its samples could stretch
  to**, and question generation refuses to put a note outside it. The flute has
  nothing usable below C4, which is why the drill never asks the flute for a C3.

Total: 49 files, about 6.6 MB, committed to the repo. Instruments are
lazy-loaded one at a time on first use (1-2 MB each), and Phase 8 adds service
worker caching.

### Considered and not used

The **[Salamander Grand Piano][sal]** (CC BY 3.0) is the piano the spec
suggests, and it does sound better than VSCO2's. It was not used because the
drill rotates instruments mid-session, so matched loudness and recording
character across all five matters more than the quality of any one — and
tonejs-instruments ships all five already volume-matched to each other. If the
piano is ever worth upgrading on its own, `InstrumentSpec.gainDb` exists to
re-match it.

## Libraries

| Library            | Licence | Used for                                    |
| ------------------ | ------- | ------------------------------------------- |
| [Tone.js][tone]    | MIT     | Web Audio scheduling and `Sampler` playback |
| [tonal][tonal]     | MIT     | Notes, intervals, scales, chords and keys   |
| [Next.js][next]    | MIT     | App framework                               |
| [React][react]     | MIT     | UI                                          |
| [Tailwind CSS][tw] | MIT     | Styling                                     |
| [next-themes][nt]  | MIT     | Light/dark theme switching                  |

## Fonts

| Font                  | Licence                   | Used for                       |
| --------------------- | ------------------------- | ------------------------------ |
| [Space Grotesk][sg]   | SIL Open Font License 1.1 | UI and headings                |
| [JetBrains Mono][jbm] | SIL Open Font License 1.1 | Labels, levels, timers, scores |

Both are served by `next/font` from Google Fonts, self-hosted at build time.

[tji]: https://github.com/nbrosowsky/tonejs-instruments
[ccby3]: https://creativecommons.org/licenses/by/3.0/
[vsco]: https://vis.versilstudios.com/vsco-community.html
[iowa]: https://theremin.music.uiowa.edu/
[karo]: https://www.karoryfer.com/karoryfer-samples
[fs]: https://freesound.org/
[sal]: https://archive.org/details/SalamanderGrandPianoV3
[tone]: https://tonejs.github.io/
[tonal]: https://github.com/tonaljs/tonal
[next]: https://nextjs.org/
[react]: https://react.dev/
[tw]: https://tailwindcss.com/
[nt]: https://github.com/pacocoursey/next-themes
[sg]: https://fonts.google.com/specimen/Space+Grotesk
[jbm]: https://fonts.google.com/specimen/JetBrains+Mono
