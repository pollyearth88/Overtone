/**
 * Roman-numeral harmony, covering the spec's progression ladder:
 * I-IV-V -> + vi -> + ii -> common pop/rock patterns -> minor keys and borrowed chords.
 *
 * Numerals are resolved against a key into a root pitch class plus a chord
 * quality, which is all the voicer and the audio need. Case carries meaning as
 * it does on paper: `IV` is major, `iv` is minor.
 */

import { chromaOf, type PitchClass } from './notes';
import { scalePitchClasses, type Key } from './keys';
import type { ChordQuality } from './chords';

/** Diatonic triads of a major key. */
export const MAJOR_NUMERALS = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'] as const;

/** Diatonic triads of a natural minor key. */
export const MINOR_NUMERALS = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] as const;

/**
 * The borrowed chords worth training: a major V in a minor key (by far the most
 * common), and the three flat-side chords a major key borrows from its parallel
 * minor.
 */
export const BORROWED_NUMERALS = ['V(major)', 'bIII', 'bVI', 'bVII', 'iv'] as const;

export const ROMAN_NUMERALS = [...MAJOR_NUMERALS, ...MINOR_NUMERALS, ...BORROWED_NUMERALS] as const;

export type RomanNumeral = (typeof ROMAN_NUMERALS)[number];

interface NumeralSpec {
  /** Semitones above the tonic for this chord's root. */
  semitones: number;
  quality: ChordQuality;
  /** Scale index to copy the spelling from, when the root is diatonic. */
  scaleIndex: number | null;
}

/** Major-key numerals, by their own name. */
const MAJOR_SPECS: Record<string, NumeralSpec> = {
  I: { semitones: 0, quality: 'maj', scaleIndex: 0 },
  ii: { semitones: 2, quality: 'min', scaleIndex: 1 },
  iii: { semitones: 4, quality: 'min', scaleIndex: 2 },
  IV: { semitones: 5, quality: 'maj', scaleIndex: 3 },
  V: { semitones: 7, quality: 'maj', scaleIndex: 4 },
  vi: { semitones: 9, quality: 'min', scaleIndex: 5 },
  'vii°': { semitones: 11, quality: 'dim', scaleIndex: 6 },
  // Borrowed from the parallel minor.
  bIII: { semitones: 3, quality: 'maj', scaleIndex: null },
  bVI: { semitones: 8, quality: 'maj', scaleIndex: null },
  bVII: { semitones: 10, quality: 'maj', scaleIndex: null },
  iv: { semitones: 5, quality: 'min', scaleIndex: 3 },
};

/** Natural-minor numerals. */
const MINOR_SPECS: Record<string, NumeralSpec> = {
  i: { semitones: 0, quality: 'min', scaleIndex: 0 },
  'ii°': { semitones: 2, quality: 'dim', scaleIndex: 1 },
  III: { semitones: 3, quality: 'maj', scaleIndex: 2 },
  iv: { semitones: 5, quality: 'min', scaleIndex: 3 },
  v: { semitones: 7, quality: 'min', scaleIndex: 4 },
  VI: { semitones: 8, quality: 'maj', scaleIndex: 5 },
  VII: { semitones: 10, quality: 'maj', scaleIndex: 6 },
  // The raised-7th dominant that actually makes a minor key sound minor.
  'V(major)': { semitones: 7, quality: 'maj', scaleIndex: 4 },
  V: { semitones: 7, quality: 'maj', scaleIndex: 4 },
};

export interface ResolvedChord {
  numeral: string;
  root: PitchClass;
  quality: ChordQuality;
}

export function isRomanNumeral(value: string): value is RomanNumeral {
  return (ROMAN_NUMERALS as readonly string[]).includes(value);
}

export function numeralsForMode(key: Key): readonly string[] {
  return key.mode === 'major' ? MAJOR_NUMERALS : MINOR_NUMERALS;
}

/**
 * Resolves a numeral in a key to a root and quality.
 *
 * Diatonic roots take their spelling from the key's scale so that `V` in Eb
 * major is `Bb`, not `A#`. Borrowed roots are spelled with flats, which is how
 * they are written (`bVI` in C major is `Ab`).
 */
export function resolveNumeral(key: Key, numeral: string): ResolvedChord {
  const table = key.mode === 'major' ? MAJOR_SPECS : MINOR_SPECS;
  const spec = table[numeral];
  if (!spec) throw new Error(`"${numeral}" is not a numeral in a ${key.mode} key`);

  const scale = scalePitchClasses(key);
  const fromScale = spec.scaleIndex === null ? undefined : scale[spec.scaleIndex];

  const targetChroma = (chromaOf(key.tonic) + spec.semitones) % 12;
  const root =
    fromScale && chromaOf(fromScale) === targetChroma ? fromScale : flatSpelling(targetChroma);

  return { numeral, root, quality: spec.quality };
}

export function resolveProgression(key: Key, numerals: readonly string[]): ResolvedChord[] {
  return numerals.map((numeral) => resolveNumeral(key, numeral));
}

const FLAT_PITCH_CLASSES: readonly PitchClass[] = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'Gb',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];

function flatSpelling(chroma: number): PitchClass {
  return FLAT_PITCH_CLASSES[((chroma % 12) + 12) % 12] ?? 'C';
}

/** Common progressions worth drilling, by the level that introduces them. */
export const PROGRESSION_PATTERNS: readonly { label: string; numerals: readonly string[] }[] = [
  { label: 'I–IV–V–I', numerals: ['I', 'IV', 'V', 'I'] },
  { label: 'I–V–vi–IV', numerals: ['I', 'V', 'vi', 'IV'] },
  { label: 'vi–IV–I–V', numerals: ['vi', 'IV', 'I', 'V'] },
  { label: 'I–vi–IV–V', numerals: ['I', 'vi', 'IV', 'V'] },
  { label: 'ii–V–I', numerals: ['ii', 'V', 'I', 'I'] },
  { label: 'I–IV–vi–V', numerals: ['I', 'IV', 'vi', 'V'] },
];
