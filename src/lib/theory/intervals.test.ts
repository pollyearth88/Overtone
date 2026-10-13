import { describe, expect, it } from 'vitest';

import {
  COMPOUND_INTERVAL_IDS,
  INTERVAL_IDS,
  INTERVAL_LABELS,
  SIMPLE_INTERVAL_IDS,
  applyInterval,
  intervalBetween,
  intervalFromSemitones,
  intervalLabel,
  intervalNotes,
  intervalSemitones,
  isIntervalId,
} from './intervals';
import { midiOf } from './notes';

describe('interval tables', () => {
  it('covers every semitone count from unison to the octave', () => {
    const semitones = SIMPLE_INTERVAL_IDS.map(intervalSemitones);
    expect(semitones).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('labels every interval', () => {
    for (const id of INTERVAL_IDS) {
      expect(INTERVAL_LABELS[id]).toBeTruthy();
      expect(intervalLabel(id)).toBe(INTERVAL_LABELS[id]);
    }
  });

  it('puts the compound intervals above the octave', () => {
    for (const id of COMPOUND_INTERVAL_IDS) {
      expect(intervalSemitones(id)).toBeGreaterThan(12);
    }
  });

  it('names the tritone once, since by ear it is one thing', () => {
    expect(intervalSemitones('A4')).toBe(6);
    expect(intervalLabel('A4')).toBe('Tritone');
    const sixes = INTERVAL_IDS.filter((id) => intervalSemitones(id) === 6);
    expect(sixes).toEqual(['A4']);
  });

  it('narrows unknown strings', () => {
    expect(isIntervalId('P5')).toBe(true);
    expect(isIntervalId('d5')).toBe(false);
  });
});

describe('intervalFromSemitones', () => {
  it('inverts intervalSemitones', () => {
    for (const id of INTERVAL_IDS) {
      expect(intervalFromSemitones(intervalSemitones(id))).toBe(id);
    }
  });

  it('ignores direction', () => {
    expect(intervalFromSemitones(-7)).toBe('P5');
    expect(intervalFromSemitones(7)).toBe('P5');
  });

  it('throws on a gap with no id, rather than guessing', () => {
    // 18 semitones has no entry: P11 is 17 and P12 is 19.
    expect(() => intervalFromSemitones(18)).toThrow();
  });
});

describe('intervalBetween', () => {
  it('reads the distance between two notes', () => {
    expect(intervalBetween('C4', 'G4')).toBe('P5');
    expect(intervalBetween('C4', 'C5')).toBe('P8');
    expect(intervalBetween('C4', 'E4')).toBe('M3');
  });

  it('is symmetric, because it ignores which note is higher', () => {
    expect(intervalBetween('G4', 'C4')).toBe('P5');
    expect(intervalBetween('C4', 'G4')).toBe('P5');
  });

  it('reads enharmonic spellings by sound', () => {
    expect(intervalBetween('C4', 'F#4')).toBe('A4');
    expect(intervalBetween('C4', 'Gb4')).toBe('A4');
  });
});

describe('applyInterval', () => {
  it('goes up by default and down on request', () => {
    expect(midiOf(applyInterval('C4', 'P5'))).toBe(midiOf('G4'));
    expect(midiOf(applyInterval('C4', 'P5', 'down'))).toBe(midiOf('F3'));
  });

  it('treats harmonic as sounding together, so the pitch matches up', () => {
    expect(midiOf(applyInterval('C4', 'M3', 'harmonic'))).toBe(midiOf(applyInterval('C4', 'M3')));
  });

  it('is exact for every interval in both directions', () => {
    for (const id of INTERVAL_IDS) {
      const semitones = intervalSemitones(id);
      expect(midiOf(applyInterval('C4', id, 'up')) - midiOf('C4')).toBe(semitones);
      expect(midiOf('C4') - midiOf(applyInterval('C4', id, 'down'))).toBe(semitones);
    }
  });
});

describe('intervalNotes', () => {
  it('always returns the pair low to high', () => {
    for (const id of INTERVAL_IDS) {
      for (const direction of ['up', 'down', 'harmonic'] as const) {
        const [low, high] = intervalNotes('C4', id, direction);
        expect(midiOf(high), `${id} ${direction}`).toBeGreaterThanOrEqual(midiOf(low));
        expect(midiOf(high) - midiOf(low)).toBe(intervalSemitones(id));
      }
    }
  });

  it('keeps the root as the top note when falling', () => {
    expect(intervalNotes('C4', 'P5', 'down')).toEqual(['F3', 'C4']);
    expect(intervalNotes('C4', 'P5', 'up')).toEqual(['C4', 'G4']);
  });
});
