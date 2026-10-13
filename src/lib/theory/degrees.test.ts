import { describe, expect, it } from 'vitest';

import {
  CHROMATIC_DEGREES,
  DEGREES,
  DEGREE_FEEL,
  MAJOR_DEGREES,
  NATURAL_MINOR_DEGREES,
  SOLFEGE,
  degreeLabel,
  degreeSemitones,
  degreeToNote,
  degreesForMode,
  isDegree,
  isDiatonicDegree,
  noteToDegree,
  octaveOffsetFromTonic,
  semitonesToDegree,
  solfege,
  type Degree,
} from './degrees';
import { ALL_KEYS, MAJOR_KEYS, MINOR_KEYS, makeKey, scalePitchClasses } from './keys';
import { chromaOf, midiOf, pitchClassOf } from './notes';

describe('degree tables', () => {
  it('has all twelve chromatic degrees', () => {
    expect(DEGREES).toHaveLength(12);
    expect(CHROMATIC_DEGREES).toHaveLength(12);
  });

  it('maps each degree to its own index as semitones', () => {
    DEGREES.forEach((degree, index) => {
      expect(degreeSemitones(degree)).toBe(index);
    });
  });

  it('labels, solfège and feel text exist for every degree', () => {
    for (const degree of DEGREES) {
      expect(SOLFEGE[degree]).toBeTruthy();
      expect(DEGREE_FEEL[degree]).toBeTruthy();
      expect(solfege(degree)).toBe(SOLFEGE[degree]);
    }
  });

  it('gives the seven degrees of each mode', () => {
    expect(MAJOR_DEGREES).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(NATURAL_MINOR_DEGREES).toEqual(['1', '2', 'b3', '4', '5', 'b6', 'b7']);
    expect(degreesForMode('major')).toEqual(MAJOR_DEGREES);
    expect(degreesForMode('minor')).toEqual(NATURAL_MINOR_DEGREES);
  });

  it('narrows unknown strings', () => {
    expect(isDegree('b3')).toBe(true);
    expect(isDegree('#9')).toBe(false);
  });
});

describe('semitonesToDegree', () => {
  it('inverts degreeSemitones', () => {
    for (const degree of DEGREES) {
      expect(semitonesToDegree(degreeSemitones(degree))).toBe(degree);
    }
  });

  it('wraps octaves and handles negatives', () => {
    expect(semitonesToDegree(12)).toBe('1');
    expect(semitonesToDegree(14)).toBe('2');
    expect(semitonesToDegree(-1)).toBe('7');
    expect(semitonesToDegree(-12)).toBe('1');
  });
});

describe('degreeToNote', () => {
  it('spells diatonic degrees from the key signature', () => {
    expect(degreeToNote(makeKey('C'), '1', 4)).toBe('C4');
    expect(degreeToNote(makeKey('C'), '3', 4)).toBe('E4');
    expect(degreeToNote(makeKey('C'), '7', 4)).toBe('B4');
    // The whole point: F major's fourth is Bb, never A#.
    expect(degreeToNote(makeKey('F'), '4', 4)).toBe('Bb4');
    expect(degreeToNote(makeKey('Eb'), '3', 3)).toBe('G3');
  });

  it('spells minor-key degrees from the natural minor scale', () => {
    expect(degreeToNote(makeKey('A', 'minor'), 'b3', 4)).toBe('C5');
    expect(degreeToNote(makeKey('A', 'minor'), 'b7', 4)).toBe('G5');
  });

  it('counts octaves from the tonic, so 7 is above the tonic not below', () => {
    expect(midiOf(degreeToNote(makeKey('C'), '7', 4))).toBe(midiOf('C4') + 11);
    // A minor: the tonic is A4, so b3 is the C *above* it.
    expect(midiOf(degreeToNote(makeKey('A', 'minor'), 'b3', 4))).toBe(midiOf('A4') + 3);
  });

  it('lands on the right pitch for every degree in every key', () => {
    for (const key of ALL_KEYS) {
      const tonicMidi = midiOf(`${key.tonic}4`);
      for (const degree of DEGREES) {
        const note = degreeToNote(key, degree, 4);
        expect(midiOf(note), `${key.tonic} ${key.mode} ${degree}`).toBe(
          tonicMidi + degreeSemitones(degree),
        );
      }
    }
  });

  it('uses the scale spelling for every diatonic degree of every key', () => {
    for (const key of ALL_KEYS) {
      const scale = scalePitchClasses(key);
      const degrees = degreesForMode(key.mode);
      degrees.forEach((degree, index) => {
        const note = degreeToNote(key, degree, 4);
        expect(pitchClassOf(note), `${key.tonic} ${key.mode} ${degree}`).toBe(scale[index]);
      });
    }
  });

  it('never produces a double accidental for a diatonic degree', () => {
    for (const key of ALL_KEYS) {
      for (const degree of degreesForMode(key.mode)) {
        expect(degreeToNote(key, degree, 4)).not.toMatch(/(bb|##)/);
      }
    }
  });
});

describe('noteToDegree', () => {
  it('reads a note back as its degree', () => {
    expect(noteToDegree(makeKey('C'), 'E4')).toBe('3');
    expect(noteToDegree(makeKey('F'), 'Bb4')).toBe('4');
    expect(noteToDegree(makeKey('A', 'minor'), 'C5')).toBe('b3');
  });

  it('ignores octave', () => {
    expect(noteToDegree(makeKey('C'), 'E2')).toBe('3');
    expect(noteToDegree(makeKey('C'), 'E6')).toBe('3');
  });

  it('round-trips degreeToNote for every degree and key', () => {
    for (const key of ALL_KEYS) {
      for (const degree of DEGREES) {
        for (const octave of [3, 4, 5]) {
          const note = degreeToNote(key, degree, octave);
          expect(noteToDegree(key, note), `${key.tonic} ${degree}`).toBe(degree);
        }
      }
    }
  });
});

describe('octaveOffsetFromTonic', () => {
  it('is 0 inside the tonic octave and 1 above it', () => {
    const key = makeKey('C');
    expect(octaveOffsetFromTonic(key, 'C4', 4)).toBe(0);
    expect(octaveOffsetFromTonic(key, 'B4', 4)).toBe(0);
    expect(octaveOffsetFromTonic(key, 'C5', 4)).toBe(1);
    expect(octaveOffsetFromTonic(key, 'B3', 4)).toBe(-1);
  });

  it('measures from the tonic, not from C', () => {
    // In A major the tonic octave starting at A4 runs up to G#5.
    const key = makeKey('A');
    expect(octaveOffsetFromTonic(key, 'A4', 4)).toBe(0);
    expect(octaveOffsetFromTonic(key, 'G#5', 4)).toBe(0);
    expect(octaveOffsetFromTonic(key, 'A5', 4)).toBe(1);
  });
});

describe('isDiatonicDegree', () => {
  it('matches the mode it belongs to', () => {
    for (const key of MAJOR_KEYS) {
      for (const degree of MAJOR_DEGREES) expect(isDiatonicDegree(key, degree)).toBe(true);
      for (const degree of ['b2', 'b3', '#4', 'b6', 'b7'] as Degree[]) {
        expect(isDiatonicDegree(key, degree)).toBe(false);
      }
    }
    for (const key of MINOR_KEYS) {
      for (const degree of NATURAL_MINOR_DEGREES) expect(isDiatonicDegree(key, degree)).toBe(true);
      for (const degree of ['b2', '3', '#4', '6', '7'] as Degree[]) {
        expect(isDiatonicDegree(key, degree)).toBe(false);
      }
    }
  });
});

describe('degreeLabel', () => {
  it('uses real accidental glyphs', () => {
    expect(degreeLabel('b3')).toBe('♭3');
    expect(degreeLabel('#4')).toBe('♯4');
    expect(degreeLabel('5')).toBe('5');
  });
});

describe('solfège', () => {
  it('uses the flat-side names for the altered degrees', () => {
    expect(solfege('b3')).toBe('Me');
    expect(solfege('b6')).toBe('Le');
    expect(solfege('b7')).toBe('Te');
    expect(solfege('#4')).toBe('Fi');
  });

  it('uses the familiar names for the major scale', () => {
    expect(MAJOR_DEGREES.map(solfege)).toEqual(['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Ti']);
  });

  it('gives every degree a distinct syllable', () => {
    const syllables = DEGREES.map(solfege);
    expect(new Set(syllables).size).toBe(syllables.length);
  });
});

describe('chroma consistency', () => {
  it('degree arithmetic agrees with chroma arithmetic', () => {
    for (const key of ALL_KEYS) {
      const tonic = chromaOf(key.tonic);
      for (const degree of DEGREES) {
        const note = degreeToNote(key, degree, 4);
        const expected = (tonic + degreeSemitones(degree)) % 12;
        expect(chromaOf(pitchClassOf(note))).toBe(expected);
      }
    }
  });
});
