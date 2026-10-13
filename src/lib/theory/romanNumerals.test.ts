import { describe, expect, it } from 'vitest';

import {
  MAJOR_NUMERALS,
  MINOR_NUMERALS,
  PROGRESSION_PATTERNS,
  numeralsForMode,
  resolveNumeral,
  resolveProgression,
} from './romanNumerals';
import { ALL_KEYS, MAJOR_KEYS, MINOR_KEYS, makeKey, scalePitchClasses } from './keys';
import { chromaOf } from './notes';

describe('resolveNumeral in major keys', () => {
  it('resolves the primary triads in C', () => {
    expect(resolveNumeral(makeKey('C'), 'I')).toMatchObject({ root: 'C', quality: 'maj' });
    expect(resolveNumeral(makeKey('C'), 'IV')).toMatchObject({ root: 'F', quality: 'maj' });
    expect(resolveNumeral(makeKey('C'), 'V')).toMatchObject({ root: 'G', quality: 'maj' });
    expect(resolveNumeral(makeKey('C'), 'vi')).toMatchObject({ root: 'A', quality: 'min' });
    expect(resolveNumeral(makeKey('C'), 'ii')).toMatchObject({ root: 'D', quality: 'min' });
    expect(resolveNumeral(makeKey('C'), 'vii°')).toMatchObject({ root: 'B', quality: 'dim' });
  });

  it('respects case: IV is major, iv is minor', () => {
    expect(resolveNumeral(makeKey('C'), 'IV').quality).toBe('maj');
    expect(resolveNumeral(makeKey('C'), 'iv').quality).toBe('min');
  });

  it('spells roots from the key signature', () => {
    // V of Eb is Bb, not A#.
    expect(resolveNumeral(makeKey('Eb'), 'V').root).toBe('Bb');
    expect(resolveNumeral(makeKey('F'), 'IV').root).toBe('Bb');
    expect(resolveNumeral(makeKey('E'), 'V').root).toBe('B');
    expect(resolveNumeral(makeKey('Db'), 'V').root).toBe('Ab');
  });

  it('gives each diatonic numeral the scale degree it names, in every major key', () => {
    for (const key of MAJOR_KEYS) {
      const scale = scalePitchClasses(key);
      MAJOR_NUMERALS.forEach((numeral, index) => {
        expect(resolveNumeral(key, numeral).root, `${key.tonic} ${numeral}`).toBe(scale[index]);
      });
    }
  });

  it('has the quality pattern of a major key', () => {
    const expected = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
    for (const key of MAJOR_KEYS) {
      expect(MAJOR_NUMERALS.map((n) => resolveNumeral(key, n).quality)).toEqual(expected);
    }
  });
});

describe('resolveNumeral in minor keys', () => {
  it('resolves the natural-minor triads in A minor', () => {
    const key = makeKey('A', 'minor');
    expect(resolveNumeral(key, 'i')).toMatchObject({ root: 'A', quality: 'min' });
    expect(resolveNumeral(key, 'iv')).toMatchObject({ root: 'D', quality: 'min' });
    expect(resolveNumeral(key, 'III')).toMatchObject({ root: 'C', quality: 'maj' });
    expect(resolveNumeral(key, 'VI')).toMatchObject({ root: 'F', quality: 'maj' });
    expect(resolveNumeral(key, 'VII')).toMatchObject({ root: 'G', quality: 'maj' });
    expect(resolveNumeral(key, 'ii°')).toMatchObject({ root: 'B', quality: 'dim' });
  });

  it('offers both the natural v and the major V', () => {
    const key = makeKey('A', 'minor');
    // Natural minor's own dominant is minor...
    expect(resolveNumeral(key, 'v')).toMatchObject({ root: 'E', quality: 'min' });
    // ...but the one that actually establishes the key is major.
    expect(resolveNumeral(key, 'V(major)')).toMatchObject({ root: 'E', quality: 'maj' });
    expect(resolveNumeral(key, 'V')).toMatchObject({ root: 'E', quality: 'maj' });
  });

  it('has the quality pattern of a natural minor key', () => {
    const expected = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];
    for (const key of MINOR_KEYS) {
      expect(MINOR_NUMERALS.map((n) => resolveNumeral(key, n).quality)).toEqual(expected);
    }
  });

  it('gives each diatonic numeral the scale degree it names, in every minor key', () => {
    for (const key of MINOR_KEYS) {
      const scale = scalePitchClasses(key);
      MINOR_NUMERALS.forEach((numeral, index) => {
        expect(resolveNumeral(key, numeral).root, `${key.tonic} ${numeral}`).toBe(scale[index]);
      });
    }
  });
});

describe('borrowed chords', () => {
  it('borrows the flat-side chords from the parallel minor', () => {
    const key = makeKey('C');
    expect(resolveNumeral(key, 'bIII')).toMatchObject({ root: 'Eb', quality: 'maj' });
    expect(resolveNumeral(key, 'bVI')).toMatchObject({ root: 'Ab', quality: 'maj' });
    expect(resolveNumeral(key, 'bVII')).toMatchObject({ root: 'Bb', quality: 'maj' });
  });

  it('spells borrowed roots with flats, as they are written', () => {
    for (const numeral of ['bIII', 'bVI', 'bVII']) {
      expect(resolveNumeral(makeKey('C'), numeral).root).toMatch(/b$|^[A-G]$/);
    }
  });

  it('puts borrowed roots at the right distance above the tonic', () => {
    const offsets: Record<string, number> = { bIII: 3, bVI: 8, bVII: 10 };
    for (const key of MAJOR_KEYS) {
      for (const [numeral, semitones] of Object.entries(offsets)) {
        const { root } = resolveNumeral(key, numeral);
        expect((chromaOf(root) - chromaOf(key.tonic) + 12) % 12, `${key.tonic} ${numeral}`).toBe(
          semitones,
        );
      }
    }
  });
});

describe('error handling', () => {
  it('rejects a numeral that does not exist in that mode', () => {
    // "III" is a minor-key numeral; a major key has "iii".
    expect(() => resolveNumeral(makeKey('C'), 'III')).toThrow();
    expect(() => resolveNumeral(makeKey('A', 'minor'), 'vi')).toThrow();
    expect(() => resolveNumeral(makeKey('C'), 'VIII')).toThrow();
  });
});

describe('resolveProgression', () => {
  it('resolves a sequence in order', () => {
    expect(resolveProgression(makeKey('C'), ['I', 'V', 'vi', 'IV']).map((c) => c.root)).toEqual([
      'C',
      'G',
      'A',
      'F',
    ]);
  });
});

describe('numeralsForMode', () => {
  it("returns the diatonic set for the key's mode", () => {
    expect(numeralsForMode(makeKey('C'))).toEqual(MAJOR_NUMERALS);
    expect(numeralsForMode(makeKey('A', 'minor'))).toEqual(MINOR_NUMERALS);
  });
});

describe('PROGRESSION_PATTERNS', () => {
  it('are all resolvable in every major key', () => {
    for (const pattern of PROGRESSION_PATTERNS) {
      for (const key of MAJOR_KEYS) {
        expect(() => resolveProgression(key, pattern.numerals), pattern.label).not.toThrow();
      }
    }
  });

  it('each have four slots, matching the drill layout', () => {
    for (const pattern of PROGRESSION_PATTERNS) {
      expect(pattern.numerals, pattern.label).toHaveLength(4);
    }
  });
});

describe('every numeral in every key', () => {
  it('resolves to a root whose chroma matches its scale degree', () => {
    for (const key of ALL_KEYS) {
      for (const numeral of numeralsForMode(key)) {
        const { root, quality } = resolveNumeral(key, numeral);
        expect(root, `${key.tonic} ${key.mode} ${numeral}`).toBeTruthy();
        expect(quality).toBeTruthy();
        expect(root).not.toMatch(/(bb|##)/);
      }
    }
  });
});
