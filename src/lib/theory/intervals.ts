/**
 * Intervals, covering the spec's interval ladder:
 * P5 vs P8 -> add M3, P4 -> all within an octave -> falling -> harmonic -> compound.
 *
 * Interval ids are the app's stable names (and part of `itemKey`s), so they are
 * plain ASCII and never re-spelled. The tritone is `A4` — one id for the
 * augmented fourth and diminished fifth, since by ear they are the same thing.
 */

import { midiOf, noteFromMidi, type NoteName } from './notes';

export const SIMPLE_INTERVAL_IDS = [
  'P1',
  'm2',
  'M2',
  'm3',
  'M3',
  'P4',
  'A4',
  'P5',
  'm6',
  'M6',
  'm7',
  'M7',
  'P8',
] as const;

export const COMPOUND_INTERVAL_IDS = ['m9', 'M9', 'm10', 'M10', 'P11', 'P12'] as const;

export const INTERVAL_IDS = [...SIMPLE_INTERVAL_IDS, ...COMPOUND_INTERVAL_IDS] as const;

export type IntervalId = (typeof INTERVAL_IDS)[number];
export type SimpleIntervalId = (typeof SIMPLE_INTERVAL_IDS)[number];

export const INTERVAL_SEMITONES: Record<IntervalId, number> = {
  P1: 0,
  m2: 1,
  M2: 2,
  m3: 3,
  M3: 4,
  P4: 5,
  A4: 6,
  P5: 7,
  m6: 8,
  M6: 9,
  m7: 10,
  M7: 11,
  P8: 12,
  m9: 13,
  M9: 14,
  m10: 15,
  M10: 16,
  P11: 17,
  P12: 19,
};

export const INTERVAL_LABELS: Record<IntervalId, string> = {
  P1: 'Unison',
  m2: 'Minor 2nd',
  M2: 'Major 2nd',
  m3: 'Minor 3rd',
  M3: 'Major 3rd',
  P4: 'Perfect 4th',
  A4: 'Tritone',
  P5: 'Perfect 5th',
  m6: 'Minor 6th',
  M6: 'Major 6th',
  m7: 'Minor 7th',
  M7: 'Major 7th',
  P8: 'Octave',
  m9: 'Minor 9th',
  M9: 'Major 9th',
  m10: 'Minor 10th',
  M10: 'Major 10th',
  P11: 'Perfect 11th',
  P12: 'Perfect 12th',
};

/** How the two notes are played. */
export type IntervalDirection = 'up' | 'down' | 'harmonic';

export function isIntervalId(value: string): value is IntervalId {
  return (INTERVAL_IDS as readonly string[]).includes(value);
}

export function intervalSemitones(id: IntervalId): number {
  return INTERVAL_SEMITONES[id];
}

export function intervalLabel(id: IntervalId): string {
  return INTERVAL_LABELS[id];
}

/**
 * The interval for a semitone count. Prefers the simple interval when one
 * exists, so 7 is `P5` rather than anything exotic.
 */
export function intervalFromSemitones(semitones: number): IntervalId {
  const absolute = Math.abs(semitones);
  const match = INTERVAL_IDS.find((id) => INTERVAL_SEMITONES[id] === absolute);
  if (!match) throw new Error(`No interval id for ${semitones} semitones`);
  return match;
}

/** Distance between two notes, ignoring which is higher. */
export function intervalBetween(a: NoteName, b: NoteName): IntervalId {
  return intervalFromSemitones(midiOf(b) - midiOf(a));
}

/**
 * The second note of the interval. `down` goes below `root`; `harmonic` sounds
 * together and so reads the same as `up`.
 */
export function applyInterval(
  root: NoteName,
  id: IntervalId,
  direction: IntervalDirection = 'up',
): NoteName {
  const semitones = intervalSemitones(id);
  const offset = direction === 'down' ? -semitones : semitones;
  return noteFromMidi(midiOf(root) + offset);
}

/** Both notes, low to high, regardless of direction. */
export function intervalNotes(
  root: NoteName,
  id: IntervalId,
  direction: IntervalDirection = 'up',
): [NoteName, NoteName] {
  const other = applyInterval(root, id, direction);
  return direction === 'down' ? [other, root] : [root, other];
}

/** Semitones the interval spans — what a range check needs. */
export function intervalSpan(id: IntervalId): number {
  return intervalSemitones(id);
}
