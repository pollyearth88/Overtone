/**
 * Pitch primitives: a thin, total layer over `tonal`'s note functions.
 *
 * `tonal` returns `null`/`NaN`/`""` for anything it cannot parse. Everything
 * here either returns a well-typed value or throws, so the rest of the app
 * never has to guess which it got.
 */

import { Note } from 'tonal';

/** A pitch with an octave, in scientific pitch notation: `C4`, `Bb3`, `F#5`. */
export type NoteName = string;

/** A pitch without an octave: `C`, `Bb`, `F#`. */
export type PitchClass = string;

export class InvalidNoteError extends Error {
  constructor(value: string) {
    super(`"${value}" is not a note name`);
    this.name = 'InvalidNoteError';
  }
}

/** MIDI number for a note, e.g. `C4` -> 60. Throws if unparseable. */
export function midiOf(note: NoteName): number {
  const midi = Note.midi(note);
  if (midi === null) throw new InvalidNoteError(note);
  return midi;
}

/** MIDI number, or `null` for anything `tonal` cannot parse. */
export function tryMidiOf(note: NoteName): number | null {
  return Note.midi(note);
}

export function isNoteName(value: string): boolean {
  return Note.midi(value) !== null;
}

/**
 * Note name for a MIDI number. Spells accidentals with flats by default,
 * because most of the keys a drill uses are flat keys.
 */
export function noteFromMidi(midi: number, options: { sharps?: boolean } = {}): NoteName {
  return options.sharps ? Note.fromMidiSharps(midi) : Note.fromMidi(midi);
}

export function octaveOf(note: NoteName): number {
  const octave = Note.get(note).oct;
  if (octave === null || octave === undefined) throw new InvalidNoteError(note);
  return octave;
}

export function pitchClassOf(note: NoteName): PitchClass {
  const pc = Note.get(note).pc;
  if (!pc) throw new InvalidNoteError(note);
  return pc;
}

/** Semitones 0-11 above C. `Db` and `C#` both give 1. */
export function chromaOf(note: NoteName | PitchClass): number {
  const chroma = Note.get(note).chroma;
  if (chroma === undefined) throw new InvalidNoteError(note);
  return chroma;
}

/** Collapses double accidentals: `Bbb3` -> `A3`, `C##4` -> `D4`. */
export function simplifyNote(note: NoteName): NoteName {
  const simplified = Note.simplify(note);
  return simplified === '' ? note : simplified;
}

export function transposeBySemitones(
  note: NoteName,
  semitones: number,
  options: { sharps?: boolean } = {},
): NoteName {
  return noteFromMidi(midiOf(note) + semitones, options);
}

/**
 * Finds the spelling of `pitchClass` that lands on exactly `midi`.
 *
 * Needed because a pitch class does not imply an octave number: `Cb4` sounds
 * the same as `B3`, so naively gluing an octave onto a pitch class can be a
 * semitone-plus-an-octave out. Returns `null` when the pitch class cannot
 * reach that MIDI number at all.
 */
export function spellAtMidi(pitchClass: PitchClass, midi: number): NoteName | null {
  const guess = Math.floor(midi / 12) - 1;
  for (const octave of [guess, guess + 1, guess - 1]) {
    const candidate = `${pitchClass}${octave}`;
    if (Note.midi(candidate) === midi) return candidate;
  }
  return null;
}

/**
 * Places `pitchClass` at the lowest octave that is at or above `floorMidi`.
 * The building block for voicing chords inside a fixed window.
 */
export function pitchClassAtOrAbove(pitchClass: PitchClass, floorMidi: number): NoteName {
  const chroma = chromaOf(pitchClass);
  // Smallest midi >= floorMidi that is congruent to chroma mod 12.
  const midi = chroma + 12 * Math.ceil((floorMidi - chroma) / 12);
  return spellAtMidi(pitchClass, midi) ?? noteFromMidi(midi);
}

/** Inclusive on both ends. */
export function isInRange(note: NoteName, low: NoteName, high: NoteName): boolean {
  const midi = midiOf(note);
  return midi >= midiOf(low) && midi <= midiOf(high);
}

export function compareNotes(a: NoteName, b: NoteName): number {
  return midiOf(a) - midiOf(b);
}

export function sortNotes(notes: readonly NoteName[]): NoteName[] {
  return [...notes].sort(compareNotes);
}

/** Replaces ASCII accidentals with the real glyphs, for display only. */
export function noteLabel(note: NoteName): string {
  return note.replace(/bb/g, '𝄫').replace(/##/g, '𝄪').replace(/b/g, '♭').replace(/#/g, '♯');
}
