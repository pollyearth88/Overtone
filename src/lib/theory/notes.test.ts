import { describe, expect, it } from 'vitest';

import {
  InvalidNoteError,
  chromaOf,
  compareNotes,
  isInRange,
  isNoteName,
  midiOf,
  noteFromMidi,
  noteLabel,
  octaveOf,
  pitchClassAtOrAbove,
  pitchClassOf,
  simplifyNote,
  sortNotes,
  spellAtMidi,
  transposeBySemitones,
  tryMidiOf,
} from './notes';

describe('midiOf', () => {
  it('uses the scientific-pitch convention where middle C is C4 = 60', () => {
    expect(midiOf('C4')).toBe(60);
    expect(midiOf('A4')).toBe(69);
    expect(midiOf('C0')).toBe(12);
  });

  it('reads both accidentals, including doubles', () => {
    expect(midiOf('C#4')).toBe(61);
    expect(midiOf('Db4')).toBe(61);
    expect(midiOf('Bbb3')).toBe(57);
    expect(midiOf('C##4')).toBe(62);
  });

  it('treats Cb and B# as the octave-crossing notes they are', () => {
    expect(midiOf('Cb4')).toBe(midiOf('B3'));
    expect(midiOf('B#3')).toBe(midiOf('C4'));
  });

  it('throws rather than returning null', () => {
    expect(() => midiOf('H4')).toThrow(InvalidNoteError);
    expect(() => midiOf('')).toThrow(InvalidNoteError);
    expect(tryMidiOf('H4')).toBeNull();
    expect(isNoteName('C4')).toBe(true);
    expect(isNoteName('nope')).toBe(false);
  });
});

describe('noteFromMidi', () => {
  it('spells with flats by default and sharps on request', () => {
    expect(noteFromMidi(61)).toBe('Db4');
    expect(noteFromMidi(61, { sharps: true })).toBe('C#4');
  });

  it("round-trips every midi number in the app's range", () => {
    for (let midi = 24; midi <= 96; midi += 1) {
      expect(midiOf(noteFromMidi(midi))).toBe(midi);
      expect(midiOf(noteFromMidi(midi, { sharps: true }))).toBe(midi);
    }
  });
});

describe('note parts', () => {
  it('splits a note into pitch class and octave', () => {
    expect(pitchClassOf('Bb3')).toBe('Bb');
    expect(octaveOf('Bb3')).toBe(3);
    expect(pitchClassOf('F#5')).toBe('F#');
    expect(octaveOf('F#5')).toBe(5);
  });

  it('reads chroma as semitones above C, ignoring spelling', () => {
    expect(chromaOf('C')).toBe(0);
    expect(chromaOf('C#')).toBe(1);
    expect(chromaOf('Db')).toBe(1);
    expect(chromaOf('B4')).toBe(11);
  });
});

describe('simplifyNote', () => {
  it('collapses double accidentals', () => {
    expect(simplifyNote('Bbb3')).toBe('A3');
    expect(simplifyNote('C##4')).toBe('D4');
  });

  it('leaves ordinary notes alone', () => {
    expect(simplifyNote('Eb4')).toBe('Eb4');
    expect(simplifyNote('C4')).toBe('C4');
  });

  it('preserves pitch', () => {
    for (const note of ['Bbb3', 'C##4', 'Cb4', 'B#3', 'Fbb5']) {
      expect(midiOf(simplifyNote(note))).toBe(midiOf(note));
    }
  });
});

describe('spellAtMidi', () => {
  it('finds the octave number that makes the pitch class land on the midi', () => {
    expect(spellAtMidi('C', 60)).toBe('C4');
    expect(spellAtMidi('Bb', 58)).toBe('Bb3');
  });

  it('handles the pitch classes whose octave number is counter-intuitive', () => {
    // Cb4 sounds like B3: gluing the "wrong" octave on would be an octave out.
    expect(spellAtMidi('Cb', 59)).toBe('Cb4');
    expect(spellAtMidi('B#', 60)).toBe('B#3');
  });

  it('returns null when the pitch class cannot reach that midi at all', () => {
    expect(spellAtMidi('C', 61)).toBeNull();
    expect(spellAtMidi('D', 60)).toBeNull();
  });
});

describe('pitchClassAtOrAbove', () => {
  it('returns the floor itself when the floor is already that pitch class', () => {
    expect(pitchClassAtOrAbove('C', 60)).toBe('C4');
    expect(midiOf(pitchClassAtOrAbove('C', 60))).toBe(60);
  });

  it('takes the next occurrence above the floor', () => {
    expect(midiOf(pitchClassAtOrAbove('C', 61))).toBe(72);
    expect(midiOf(pitchClassAtOrAbove('E', 60))).toBe(64);
    expect(midiOf(pitchClassAtOrAbove('B', 60))).toBe(71);
  });

  it('never returns a note below the floor, for every pitch class and floor', () => {
    const pitchClasses = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
    for (const pc of pitchClasses) {
      for (let floor = 40; floor <= 84; floor += 1) {
        const midi = midiOf(pitchClassAtOrAbove(pc, floor));
        expect(midi).toBeGreaterThanOrEqual(floor);
        // And it is the *lowest* such note: one octave down would be too low.
        expect(midi - 12).toBeLessThan(floor);
        expect(midi % 12).toBe(chromaOf(pc));
      }
    }
  });
});

describe('ranges and ordering', () => {
  it('treats range bounds as inclusive', () => {
    expect(isInRange('C3', 'C3', 'C6')).toBe(true);
    expect(isInRange('C6', 'C3', 'C6')).toBe(true);
    expect(isInRange('B2', 'C3', 'C6')).toBe(false);
    expect(isInRange('Db6', 'C3', 'C6')).toBe(false);
  });

  it('sorts by pitch, not by name', () => {
    expect(sortNotes(['G4', 'C4', 'Bb3'])).toEqual(['Bb3', 'C4', 'G4']);
    expect(compareNotes('C4', 'C4')).toBe(0);
    expect(compareNotes('C4', 'D4')).toBeLessThan(0);
  });
});

describe('transposeBySemitones', () => {
  it('moves by exact semitones', () => {
    expect(transposeBySemitones('C4', 7)).toBe('G4');
    expect(transposeBySemitones('C4', -1)).toBe('B3');
    expect(transposeBySemitones('C4', 12)).toBe('C5');
  });
});

describe('noteLabel', () => {
  it('swaps ASCII accidentals for the real glyphs', () => {
    expect(noteLabel('Bb3')).toBe('B♭3');
    expect(noteLabel('F#5')).toBe('F♯5');
    expect(noteLabel('C4')).toBe('C4');
  });

  it('handles doubles without mangling them into two singles', () => {
    expect(noteLabel('Bbb3')).toBe('B𝄫3');
    expect(noteLabel('C##4')).toBe('C𝄪4');
  });
});
