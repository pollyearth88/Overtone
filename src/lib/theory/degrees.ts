/**
 * Scale degrees — the thing Overtone actually trains.
 *
 * A degree is named relative to the tonic, so `3` is the major third of
 * whatever key is in play. All twelve chromatic degrees exist; which subset a
 * drill uses is a property of the level, not of this module.
 *
 * Degrees are the app's spaced-review unit too: `itemKey`s are built from them,
 * which is why the labels here are stable strings and never re-spelled.
 */

import { isDiatonic, scalePitchClasses, prefersFlats, type Key, type KeyMode } from './keys';
import { chromaOf, midiOf, noteFromMidi, pitchClassOf, spellAtMidi, type NoteName } from './notes';

/** All twelve, ascending from the tonic. */
export const DEGREES = ['1', 'b2', '2', 'b3', '3', '4', '#4', '5', 'b6', '6', 'b7', '7'] as const;

export type Degree = (typeof DEGREES)[number];

/** Semitones above the tonic. The index into `DEGREES` is the same number. */
export const DEGREE_SEMITONES: Record<Degree, number> = {
  '1': 0,
  b2: 1,
  '2': 2,
  b3: 3,
  '3': 4,
  '4': 5,
  '#4': 6,
  '5': 7,
  b6: 8,
  '6': 9,
  b7: 10,
  '7': 11,
};

export const MAJOR_DEGREES: readonly Degree[] = ['1', '2', '3', '4', '5', '6', '7'];
export const NATURAL_MINOR_DEGREES: readonly Degree[] = ['1', '2', 'b3', '4', '5', 'b6', 'b7'];
export const CHROMATIC_DEGREES: readonly Degree[] = DEGREES;

/**
 * Moveable-do solfège. The altered degrees use the descending (flat-side)
 * names — `Me`, `Le`, `Te` — which is what functional ear-training material
 * uses, with `Fi` for the raised fourth.
 */
export const SOLFEGE: Record<Degree, string> = {
  '1': 'Do',
  b2: 'Ra',
  '2': 'Re',
  b3: 'Me',
  '3': 'Mi',
  '4': 'Fa',
  '#4': 'Fi',
  '5': 'Sol',
  b6: 'Le',
  '6': 'La',
  b7: 'Te',
  '7': 'Ti',
};

/**
 * One line on how each degree feels against the tonic. Shown in drill feedback,
 * because naming the sensation is what makes the interval stick.
 */
export const DEGREE_FEEL: Record<Degree, string> = {
  '1': 'Home. Settled, nothing left to resolve.',
  b2: 'Tense and leaning hard down onto the tonic.',
  '2': 'A step up and restless — wants to fall back home.',
  b3: 'The minor third. Darker, sadder than 3.',
  '3': 'Bright and major. The note that makes a key sound happy.',
  '4': 'Open and slightly unstable, pulling down toward 3.',
  '#4': 'Floating and unresolved — the tritone from home.',
  '5': 'Strong and stable. The other note that feels like ground.',
  b6: 'Heavy and melancholy, pressing down toward 5.',
  '6': 'Warm and wistful, lighter than b6.',
  b7: 'Bluesy. Relaxes downward instead of resolving up.',
  '7': 'Tightest pull of all — one semitone under home.',
};

export function degreesForMode(mode: KeyMode): readonly Degree[] {
  return mode === 'major' ? MAJOR_DEGREES : NATURAL_MINOR_DEGREES;
}

export function isDegree(value: string): value is Degree {
  return (DEGREES as readonly string[]).includes(value);
}

export function degreeSemitones(degree: Degree): number {
  return DEGREE_SEMITONES[degree];
}

export function semitonesToDegree(semitones: number): Degree {
  const index = ((semitones % 12) + 12) % 12;
  const degree = DEGREES[index];
  if (!degree) throw new Error(`No degree for ${semitones} semitones`);
  return degree;
}

/** `b3` -> `♭3`, for display. */
export function degreeLabel(degree: Degree): string {
  return degree.replace('b', '♭').replace('#', '♯');
}

export function solfege(degree: Degree): string {
  return SOLFEGE[degree];
}

/**
 * The note a degree lands on, spelled for the key.
 *
 * Diatonic degrees take their spelling straight from the scale, so degree 4 of
 * F major is `Bb` rather than `A#`. Altered degrees fall back to the key's
 * accidental preference.
 *
 * `octave` is the octave of the tonic, so `degreeToNote(C major, '7', 4)` is
 * `B4` and `degreeToNote(C major, '1', 4)` is `C4`.
 */
export function degreeToNote(key: Key, degree: Degree, octave: number): NoteName {
  const tonicMidi = midiOf(`${key.tonic}${octave}`);
  const midi = tonicMidi + degreeSemitones(degree);

  const scale = scalePitchClasses(key);
  const match = scale.find((pc) => chromaOf(pc) === ((midi % 12) + 12) % 12);
  if (match) {
    const spelled = spellAtMidi(match, midi);
    if (spelled) return spelled;
  }

  return noteFromMidi(midi, { sharps: !prefersFlats(key) });
}

/** Which degree a note is in a key, ignoring octave. */
export function noteToDegree(key: Key, note: NoteName): Degree {
  const tonicChroma = chromaOf(key.tonic);
  const noteChroma = chromaOf(pitchClassOf(note));
  return semitonesToDegree(noteChroma - tonicChroma);
}

/**
 * How many octaves above the tonic a note sits. `0` for the octave starting on
 * the tonic itself, `1` for the one above. Drill levels that span two octaves
 * use this to tell `5` from the `5` an octave up.
 */
export function octaveOffsetFromTonic(key: Key, note: NoteName, tonicOctave: number): number {
  const tonicMidi = midiOf(`${key.tonic}${tonicOctave}`);
  return Math.floor((midiOf(note) - tonicMidi) / 12);
}

/**
 * `isDiatonic` on a degree rather than a note — true when the degree belongs to
 * the key's own scale.
 */
export function isDiatonicDegree(key: Key, degree: Degree): boolean {
  return isDiatonic(key, degreeToNote(key, degree, 4));
}
