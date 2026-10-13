import { describe, expect, it } from 'vitest';

import {
  ALL_KEYS,
  MAJOR_KEYS,
  MINOR_KEYS,
  isDiatonic,
  keyId,
  keyLabel,
  keysEqual,
  makeKey,
  prefersFlats,
  scalePitchClasses,
} from './keys';
import { chromaOf } from './notes';

describe('key lists', () => {
  it('has twelve of each, and all twenty-four together', () => {
    expect(MAJOR_KEYS).toHaveLength(12);
    expect(MINOR_KEYS).toHaveLength(12);
    expect(ALL_KEYS).toHaveLength(24);
  });

  it('covers all twelve pitch classes exactly once per mode', () => {
    for (const keys of [MAJOR_KEYS, MINOR_KEYS]) {
      const chromas = keys.map((key) => chromaOf(key.tonic)).sort((a, b) => a - b);
      expect(chromas).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    }
  });

  it('spells tonics the way musicians write them', () => {
    // Flats on the flat side for major, sharps on the sharp side for minor.
    expect(MAJOR_KEYS.map((k) => k.tonic)).toContain('Db');
    expect(MAJOR_KEYS.map((k) => k.tonic)).not.toContain('C#');
    expect(MINOR_KEYS.map((k) => k.tonic)).toContain('C#');
    expect(MINOR_KEYS.map((k) => k.tonic)).not.toContain('Db');
  });

  it('never needs a double accidental to spell its scale', () => {
    for (const key of ALL_KEYS) {
      for (const pc of scalePitchClasses(key)) {
        expect(pc, `${keyId(key)} contains ${pc}`).not.toMatch(/(bb|##)/);
      }
    }
  });
});

describe('scalePitchClasses', () => {
  it('gives the major scale', () => {
    expect(scalePitchClasses(makeKey('C'))).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(scalePitchClasses(makeKey('F'))).toEqual(['F', 'G', 'A', 'Bb', 'C', 'D', 'E']);
  });

  it('gives the natural minor scale, not the harmonic one', () => {
    expect(scalePitchClasses(makeKey('A', 'minor'))).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    // Natural minor means a flat 7: G, never G#.
    expect(scalePitchClasses(makeKey('A', 'minor'))[6]).toBe('G');
  });

  it('always returns seven notes starting on the tonic', () => {
    for (const key of ALL_KEYS) {
      const scale = scalePitchClasses(key);
      expect(scale, keyId(key)).toHaveLength(7);
      expect(scale[0]).toBe(key.tonic);
    }
  });

  it('has the right semitone pattern for its mode', () => {
    const major = [0, 2, 4, 5, 7, 9, 11];
    const minor = [0, 2, 3, 5, 7, 8, 10];
    for (const key of ALL_KEYS) {
      const tonic = chromaOf(key.tonic);
      const steps = scalePitchClasses(key).map((pc) => (((chromaOf(pc) - tonic) % 12) + 12) % 12);
      expect(steps, keyId(key)).toEqual(key.mode === 'major' ? major : minor);
    }
  });
});

describe('prefersFlats', () => {
  it('follows the key signature', () => {
    expect(prefersFlats(makeKey('F'))).toBe(true);
    expect(prefersFlats(makeKey('Bb'))).toBe(true);
    expect(prefersFlats(makeKey('G'))).toBe(false);
    expect(prefersFlats(makeKey('F#'))).toBe(false);
  });

  it('treats C major as a sharp key for altered notes', () => {
    // No signature to follow, so raised degrees read as sharps: #4 is F#.
    expect(prefersFlats(makeKey('C'))).toBe(false);
  });
});

describe('isDiatonic', () => {
  it("matches the key's own scale notes", () => {
    expect(isDiatonic(makeKey('C'), 'E')).toBe(true);
    expect(isDiatonic(makeKey('C'), 'F#')).toBe(false);
    expect(isDiatonic(makeKey('F'), 'Bb')).toBe(true);
  });

  it('compares by sound, so enharmonic spellings count', () => {
    // Bb major contains Bb; A# is the same pitch.
    expect(isDiatonic(makeKey('Bb'), 'A#')).toBe(true);
  });

  it('accepts notes with an octave as well as bare pitch classes', () => {
    expect(isDiatonic(makeKey('C'), 'E4')).toBe(true);
    expect(isDiatonic(makeKey('C'), 'F#3')).toBe(false);
  });
});

describe('identity helpers', () => {
  it('builds stable ids and readable labels', () => {
    expect(keyId(makeKey('Bb', 'minor'))).toBe('Bb-minor');
    expect(keyLabel(makeKey('Bb', 'minor'))).toBe('B♭ minor');
    expect(keyLabel(makeKey('F#', 'minor'))).toBe('F♯ minor');
  });

  it('compares tonic and mode together', () => {
    expect(keysEqual(makeKey('C'), makeKey('C'))).toBe(true);
    expect(keysEqual(makeKey('C'), makeKey('C', 'minor'))).toBe(false);
  });
});
