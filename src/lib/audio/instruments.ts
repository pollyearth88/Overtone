/**
 * The instrument manifest: the single source of truth for which instruments
 * exist, which sample files back them, and the pitch range each one can play
 * convincingly.
 *
 * `scripts/fetch-samples.mjs` reads this file to download the samples, so the
 * list here and the contents of `public/samples/` can never drift apart.
 *
 * Sample sources and licences are recorded in `docs/CREDITS.md`.
 */

export const INSTRUMENT_IDS = [
  'piano',
  'guitar-acoustic',
  'guitar-electric',
  'cello',
  'flute',
] as const;

export type InstrumentId = (typeof INSTRUMENT_IDS)[number];

export interface InstrumentSpec {
  id: InstrumentId;
  /** Shown in the UI. */
  label: string;
  /**
   * Sampled pitches, in scientific pitch notation. Spaced closely enough that
   * `Tone.Sampler` never pitch-shifts a sample more than ~2-3 semitones, which
   * is where the timbre starts to give the trick away.
   */
  samples: readonly string[];
  /**
   * The range drills may use, inclusive. Narrower than what the samples could
   * technically stretch to — questions must sound like the instrument, not like
   * a stretched sample.
   */
  range: { low: string; high: string };
  /**
   * Level trim in dB, applied on top of the master volume. The sample sets come
   * from different sources; this is what keeps one instrument from jumping out
   * when the drill rotates to it mid-session.
   */
  gainDb: number;
  /** Seconds of release tail, passed to `Tone.Sampler`. */
  release: number;
}

/**
 * Sharps are written `#` here but the sample files on disk spell them `s`
 * (`G#3` -> `Gs3.mp3`), which is how the upstream sample set names them.
 */
export function sampleFileName(note: string): string {
  return `${note.replace('#', 's')}.mp3`;
}

export const INSTRUMENTS: Record<InstrumentId, InstrumentSpec> = {
  piano: {
    id: 'piano',
    label: 'Piano',
    // Major thirds: no sample is stretched more than 2 semitones.
    samples: ['C3', 'E3', 'G#3', 'C4', 'E4', 'G#4', 'C5', 'E5', 'G#5', 'C6'],
    range: { low: 'C3', high: 'C6' },
    gainDb: 0,
    release: 1,
  },
  'guitar-acoustic': {
    id: 'guitar-acoustic',
    label: 'Acoustic guitar',
    samples: ['E2', 'G#2', 'C3', 'E3', 'G#3', 'C4', 'E4', 'G#4', 'C5'],
    range: { low: 'E2', high: 'C5' },
    gainDb: 2,
    release: 0.8,
  },
  'guitar-electric': {
    id: 'guitar-electric',
    label: 'Electric guitar',
    // This set is only sampled in minor thirds, so that is the grid we get.
    samples: ['C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6'],
    range: { low: 'C3', high: 'C6' },
    gainDb: 0,
    release: 0.8,
  },
  cello: {
    id: 'cello',
    label: 'Cello',
    samples: ['C2', 'E2', 'G#2', 'C3', 'E3', 'G#3', 'C4', 'E4', 'G#4', 'C5'],
    range: { low: 'C2', high: 'C5' },
    gainDb: 1,
    release: 1,
  },
  flute: {
    id: 'flute',
    label: 'Flute',
    // The thinnest set upstream: C/E/A only, and nothing usable below C4.
    samples: ['C4', 'E4', 'A4', 'C5', 'E5', 'A5', 'C6'],
    range: { low: 'C4', high: 'C6' },
    gainDb: -4,
    release: 0.6,
  },
};

export const ALL_INSTRUMENTS: readonly InstrumentSpec[] = INSTRUMENT_IDS.map(
  (id) => INSTRUMENTS[id],
);

/** The instrument a drill falls back to when the user has allowed nothing else. */
export const DEFAULT_INSTRUMENT: InstrumentId = 'piano';

export function isInstrumentId(value: string): value is InstrumentId {
  return (INSTRUMENT_IDS as readonly string[]).includes(value);
}

export function getInstrument(id: InstrumentId): InstrumentSpec {
  return INSTRUMENTS[id];
}
