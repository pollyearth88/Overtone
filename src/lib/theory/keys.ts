/**
 * Keys: a tonic plus a mode, and the scale that comes with it.
 *
 * Only major and natural minor exist here, because those are the two ladders
 * the spec's modes use. The key lists are deliberately the *practical* twelve
 * of each rather than every spelling `tonal` can produce — a drill should never
 * ask about `D# minor` and show the user a `Cb`.
 */

import { Scale } from 'tonal';

import { chromaOf, type NoteName, type PitchClass } from './notes';

export type KeyMode = 'major' | 'minor';

export interface Key {
  tonic: PitchClass;
  mode: KeyMode;
}

/**
 * The twelve major keys, spelled the way musicians write them: flats past
 * three sharps, so `Db` not `C#`.
 */
export const MAJOR_TONICS: readonly PitchClass[] = [
  'C',
  'Db',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'Ab',
  'A',
  'Bb',
  'B',
];

/**
 * The twelve minor keys. Sharps are preferred here for the same reason flats
 * are above: `C# minor` has four sharps, `Db minor` would have eight flats.
 */
export const MINOR_TONICS: readonly PitchClass[] = [
  'A',
  'Bb',
  'B',
  'C',
  'C#',
  'D',
  'Eb',
  'E',
  'F',
  'F#',
  'G',
  'G#',
];

export const MAJOR_KEYS: readonly Key[] = MAJOR_TONICS.map((tonic) => ({ tonic, mode: 'major' }));
export const MINOR_KEYS: readonly Key[] = MINOR_TONICS.map((tonic) => ({ tonic, mode: 'minor' }));
export const ALL_KEYS: readonly Key[] = [...MAJOR_KEYS, ...MINOR_KEYS];

export function makeKey(tonic: PitchClass, mode: KeyMode = 'major'): Key {
  return { tonic, mode };
}

export function keyId(key: Key): string {
  return `${key.tonic}-${key.mode}`;
}

export function keyLabel(key: Key): string {
  const tonic = key.tonic.replace(/b/g, '♭').replace(/#/g, '♯');
  return `${tonic} ${key.mode}`;
}

export function keysEqual(a: Key, b: Key): boolean {
  return a.tonic === b.tonic && a.mode === b.mode;
}

/** The seven pitch classes of the key, starting on the tonic. */
export function scalePitchClasses(key: Key): PitchClass[] {
  const name = key.mode === 'major' ? 'major' : 'aeolian';
  return Scale.get(`${key.tonic} ${name}`).notes;
}

/**
 * Whether the key writes its accidentals as flats. Used to spell notes that
 * fall outside the scale, where there is no scale degree to copy from.
 */
export function prefersFlats(key: Key): boolean {
  if (key.tonic.includes('b')) return true;
  if (key.tonic.includes('#')) return false;
  // Naturals: F major and the minor keys on C, D, F and G are flat keys.
  const flatNaturals = key.mode === 'major' ? ['F'] : ['C', 'D', 'F', 'G'];
  return flatNaturals.includes(key.tonic);
}

/**
 * True when `note` is one of the key's seven scale notes, ignoring octave.
 * Compares by chroma, so `A#` counts as diatonic to Bb major just like `Bb`.
 */
export function isDiatonic(key: Key, note: NoteName | PitchClass): boolean {
  const target = chromaOf(note);
  return scalePitchClasses(key).some((pc) => chromaOf(pc) === target);
}
