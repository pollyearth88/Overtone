/**
 * Chord qualities and inversions, covering the spec's chord ladder:
 * major vs minor -> + diminished, augmented -> 7ths -> inversions -> extended.
 *
 * Chords are defined by their semitone offsets above the root rather than by
 * `tonal` chord names, because the offsets are what both the audio and the
 * range checks need, and they make inversion arithmetic obvious.
 */

import { midiOf, noteFromMidi, spellAtMidi, type NoteName, type PitchClass } from './notes';
import { Chord } from 'tonal';

export const TRIAD_QUALITIES = ['maj', 'min', 'dim', 'aug', 'sus4'] as const;
export const SEVENTH_QUALITIES = ['maj7', 'dom7', 'min7', 'm7b5', 'dim7', 'minMaj7'] as const;
export const EXTENDED_QUALITIES = ['maj9', 'dom9', 'min9'] as const;

export const CHORD_QUALITIES = [
  ...TRIAD_QUALITIES,
  ...SEVENTH_QUALITIES,
  ...EXTENDED_QUALITIES,
] as const;

export type ChordQuality = (typeof CHORD_QUALITIES)[number];

export interface ChordQualitySpec {
  id: ChordQuality;
  /** Full name, for answer buttons and feedback. */
  label: string;
  /** Suffix after the root, e.g. `m7b5` in `Cm7b5`. */
  symbol: string;
  /** Semitones above the root, ascending, root first. */
  semitones: readonly number[];
  /** `tonal`'s name for this chord type, used only for canonical spelling. */
  tonalType: string;
}

export const CHORD_QUALITY_SPECS: Record<ChordQuality, ChordQualitySpec> = {
  maj: { id: 'maj', label: 'Major', symbol: '', semitones: [0, 4, 7], tonalType: 'M' },
  min: { id: 'min', label: 'Minor', symbol: 'm', semitones: [0, 3, 7], tonalType: 'm' },
  dim: { id: 'dim', label: 'Diminished', symbol: 'dim', semitones: [0, 3, 6], tonalType: 'dim' },
  aug: { id: 'aug', label: 'Augmented', symbol: 'aug', semitones: [0, 4, 8], tonalType: 'aug' },
  sus4: {
    id: 'sus4',
    label: 'Suspended 4th',
    symbol: 'sus4',
    semitones: [0, 5, 7],
    tonalType: 'sus4',
  },

  maj7: {
    id: 'maj7',
    label: 'Major 7th',
    symbol: 'maj7',
    semitones: [0, 4, 7, 11],
    tonalType: 'maj7',
  },
  dom7: {
    id: 'dom7',
    label: 'Dominant 7th',
    symbol: '7',
    semitones: [0, 4, 7, 10],
    tonalType: '7',
  },
  min7: { id: 'min7', label: 'Minor 7th', symbol: 'm7', semitones: [0, 3, 7, 10], tonalType: 'm7' },
  m7b5: {
    id: 'm7b5',
    label: 'Half-diminished',
    symbol: 'm7b5',
    semitones: [0, 3, 6, 10],
    tonalType: 'm7b5',
  },
  dim7: {
    id: 'dim7',
    label: 'Diminished 7th',
    symbol: 'dim7',
    semitones: [0, 3, 6, 9],
    tonalType: 'dim7',
  },
  minMaj7: {
    id: 'minMaj7',
    label: 'Minor-major 7th',
    symbol: 'mMaj7',
    semitones: [0, 3, 7, 11],
    tonalType: 'mMaj7',
  },

  maj9: {
    id: 'maj9',
    label: 'Major 9th',
    symbol: 'maj9',
    semitones: [0, 4, 7, 11, 14],
    tonalType: 'maj9',
  },
  dom9: {
    id: 'dom9',
    label: 'Dominant 9th',
    symbol: '9',
    semitones: [0, 4, 7, 10, 14],
    tonalType: '9',
  },
  min9: {
    id: 'min9',
    label: 'Minor 9th',
    symbol: 'm9',
    semitones: [0, 3, 7, 10, 14],
    tonalType: 'm9',
  },
};

/** `0` is root position, `1` first inversion, and so on. */
export type Inversion = 0 | 1 | 2 | 3 | 4;

export const INVERSION_LABELS = [
  'Root position',
  '1st inversion',
  '2nd inversion',
  '3rd inversion',
  '4th inversion',
] as const;

export interface ChordSpec {
  root: PitchClass;
  quality: ChordQuality;
  /** Octave of the root in root position. */
  octave: number;
  inversion?: Inversion;
}

export function isChordQuality(value: string): value is ChordQuality {
  return (CHORD_QUALITIES as readonly string[]).includes(value);
}

export function chordQualitySpec(quality: ChordQuality): ChordQualitySpec {
  return CHORD_QUALITY_SPECS[quality];
}

export function chordSize(quality: ChordQuality): number {
  return CHORD_QUALITY_SPECS[quality].semitones.length;
}

/** The highest inversion that still has a different note in the bass. */
export function maxInversion(quality: ChordQuality): Inversion {
  return (chordSize(quality) - 1) as Inversion;
}

export function inversionLabel(inversion: Inversion): string {
  return INVERSION_LABELS[inversion] ?? `Inversion ${inversion}`;
}

/** `C`, `Cm7`, `Cm7b5`. */
export function chordSymbol(root: PitchClass, quality: ChordQuality): string {
  return `${root}${CHORD_QUALITY_SPECS[quality].symbol}`;
}

/**
 * Canonical pitch-class spellings from `tonal`, aligned to the quality's
 * semitone offsets. Falls back to plain semitone spelling for anything `tonal`
 * does not recognise.
 *
 * These are the theoretically correct names, which means a diminished 7th comes
 * back with a `Bbb` in it. That is intentional — `simplifyNote` exists for
 * where a UI would rather show `A`.
 */
export function chordPitchClasses(root: PitchClass, quality: ChordQuality): PitchClass[] {
  const spec = CHORD_QUALITY_SPECS[quality];
  const notes = Chord.getChord(spec.tonalType, root).notes;
  const rootMidi = midiOf(`${root}4`);

  return spec.semitones.map((offset, index) => {
    const named = notes[index];
    if (named) return named;
    // `tonal` did not recognise the type: spell it from the semitone offset.
    return noteFromMidi(rootMidi + offset).replace(/-?\d+$/, '');
  });
}

/**
 * The chord's notes as actual pitches, ascending.
 *
 * Inversions move the lowest `inversion` voices up an octave, which is what
 * inversion means in practice and keeps the result ascending.
 */
export function chordNotes(spec: ChordSpec): NoteName[] {
  const { root, quality, octave, inversion = 0 } = spec;
  const { semitones } = CHORD_QUALITY_SPECS[quality];
  const pitchClasses = chordPitchClasses(root, quality);
  const rootMidi = midiOf(`${root}${octave}`);

  const midis = semitones.map((offset, index) =>
    index < inversion ? rootMidi + offset + 12 : rootMidi + offset,
  );

  const indexed = midis.map((midi, index) => ({ midi, pc: pitchClasses[index] }));
  indexed.sort((a, b) => a.midi - b.midi);

  return indexed.map(({ midi, pc }) => (pc ? spellAtMidi(pc, midi) : null) ?? noteFromMidi(midi));
}

/** Semitones from the lowest to the highest note — what a range check needs. */
export function chordSpan(quality: ChordQuality, inversion: Inversion = 0): number {
  const { semitones } = CHORD_QUALITY_SPECS[quality];
  const midis = semitones.map((offset, index) => (index < inversion ? offset + 12 : offset));
  return Math.max(...midis) - Math.min(...midis);
}

/**
 * Semitones from the chord's root pitch to its lowest sounding note. Negative
 * is impossible; inversions raise voices rather than lowering the root, so the
 * bass of a first-inversion C major (`E`) is 4 semitones above the root `C`.
 */
export function chordBassOffset(quality: ChordQuality, inversion: Inversion = 0): number {
  const { semitones } = CHORD_QUALITY_SPECS[quality];
  const midis = semitones.map((offset, index) => (index < inversion ? offset + 12 : offset));
  return Math.min(...midis);
}
