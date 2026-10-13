import { describe, expect, it } from 'vitest';

import {
  MAJOR_CADENCE,
  MINOR_CADENCE,
  buildCadence,
  buildRootReference,
  buildTonicReference,
  cadenceChords,
  cadenceNotes,
  cadenceVoicing,
} from './cadence';
import { ALL_KEYS, MAJOR_KEYS, MINOR_KEYS, makeKey } from './keys';
import { chromaOf, midiOf } from './notes';
import { eventNotes, sequenceDuration } from '../audio/events';
import { getInstrument } from '../audio/instruments';

describe('cadenceChords', () => {
  it('is I-IV-V-I in a major key', () => {
    expect(cadenceChords(makeKey('C')).map((c) => c.symbol)).toEqual(['C', 'F', 'G', 'C']);
    expect(MAJOR_CADENCE).toEqual(['I', 'IV', 'V', 'I']);
  });

  it('is i-iv-V-i in a minor key, with a *major* V', () => {
    // A minor v would leave the key ambiguous; the raised third is what makes
    // the ear commit to the key.
    const chords = cadenceChords(makeKey('A', 'minor'));
    expect(chords.map((c) => c.symbol)).toEqual(['Am', 'Dm', 'E', 'Am']);
    expect(chords[2]!.quality).toBe('maj');
    expect(MINOR_CADENCE).toEqual(['i', 'iv', 'V(major)', 'i']);
  });

  it('has four chords starting and ending on the tonic, in every key', () => {
    for (const key of ALL_KEYS) {
      const chords = cadenceChords(key);
      expect(chords, `${key.tonic} ${key.mode}`).toHaveLength(4);
      expect(chromaOf(chords[0]!.root)).toBe(chromaOf(key.tonic));
      expect(chromaOf(chords[3]!.root)).toBe(chromaOf(key.tonic));
      // IV is five semitones up, V is seven.
      expect((chromaOf(chords[1]!.root) - chromaOf(key.tonic) + 12) % 12).toBe(5);
      expect((chromaOf(chords[2]!.root) - chromaOf(key.tonic) + 12) % 12).toBe(7);
    }
  });

  it('always makes the dominant major, in both modes', () => {
    for (const key of ALL_KEYS) {
      expect(cadenceChords(key)[2]!.quality, `${key.tonic} ${key.mode}`).toBe('maj');
    }
  });

  it('matches the mode of the tonic chord to the key', () => {
    for (const key of MAJOR_KEYS) expect(cadenceChords(key)[0]!.quality).toBe('maj');
    for (const key of MINOR_KEYS) expect(cadenceChords(key)[0]!.quality).toBe('min');
  });
});

describe('cadenceVoicing', () => {
  it('voices C major the textbook way', () => {
    const voiced = cadenceVoicing(makeKey('C'));
    expect(voiced.map((c) => c.notes)).toEqual([
      ['C3', 'E4', 'G4', 'C5'],
      ['F3', 'F4', 'A4', 'C5'],
      ['G3', 'G4', 'B4', 'D5'],
      ['C3', 'G4', 'C5', 'E5'],
    ]);
  });
});

describe('cadence range', () => {
  /**
   * The cadence is always played on the reference instrument, so it has to fit
   * that instrument's sampled range in all 24 keys — otherwise the key
   * reference itself would be a stretched sample. This is the check that
   * justifies pinning the cadence register instead of rotating it.
   */
  it("fits the piano's sampled range in every key, at the default register", () => {
    const piano = getInstrument('piano');
    const low = midiOf(piano.range.low);
    const high = midiOf(piano.range.high);

    for (const key of ALL_KEYS) {
      for (const note of cadenceNotes(key)) {
        const midi = midiOf(note);
        expect(
          midi,
          `${key.tonic} ${key.mode}: ${note} below ${piano.range.low}`,
        ).toBeGreaterThanOrEqual(low);
        expect(
          midi,
          `${key.tonic} ${key.mode}: ${note} above ${piano.range.high}`,
        ).toBeLessThanOrEqual(high);
      }
    }
  });

  it('stays within a comfortable two-and-a-bit octaves', () => {
    for (const key of ALL_KEYS) {
      const midis = cadenceNotes(key).map(midiOf);
      expect(
        Math.max(...midis) - Math.min(...midis),
        `${key.tonic} ${key.mode}`,
      ).toBeLessThanOrEqual(30);
    }
  });
});

describe('buildCadence', () => {
  it('emits four chords in time order', () => {
    const events = buildCadence(makeKey('C'));
    const chords = events.filter((event) => event.kind === 'chord');
    expect(chords).toHaveLength(4);

    const times = chords.map((event) => event.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[0]).toBe(0);
  });

  it('holds the final tonic longer than the chords before it', () => {
    const chords = buildCadence(makeKey('C')).filter((event) => event.kind === 'chord');
    const last = chords[3]!;
    expect(last.duration).toBeGreaterThan(chords[0]!.duration);
  });

  it('leaves silence after the cadence so the key can settle', () => {
    const events = buildCadence(makeKey('C'), { tailSilence: 0.4 });
    const rests = events.filter((event) => event.kind === 'rest');
    expect(rests).toHaveLength(1);
    expect(rests[0]!.ms).toBeCloseTo(400);
  });

  it('omits the rest when no tail is asked for', () => {
    const events = buildCadence(makeKey('C'), { tailSilence: 0 });
    expect(events.filter((event) => event.kind === 'rest')).toHaveLength(0);
  });

  it('tags every chord with the instrument when one is given', () => {
    const events = buildCadence(makeKey('C'), { instrument: 'cello' });
    for (const event of events) {
      if (event.kind === 'chord') expect(event.instrument).toBe('cello');
    }
  });

  it('leaves the instrument unset by default, so the engine default wins', () => {
    const events = buildCadence(makeKey('C'));
    for (const event of events) {
      if (event.kind === 'chord') expect(event.instrument).toBeUndefined();
    }
  });

  it('plays the same notes the voicing describes', () => {
    for (const key of ALL_KEYS) {
      expect(eventNotes(buildCadence(key))).toEqual(cadenceNotes(key));
    }
  });

  it('runs about three seconds — short enough to replay without impatience', () => {
    const duration = sequenceDuration(buildCadence(makeKey('C')));
    expect(duration).toBeGreaterThan(1.5);
    expect(duration).toBeLessThan(4);
  });

  it('is deterministic', () => {
    expect(buildCadence(makeKey('F'))).toEqual(buildCadence(makeKey('F')));
  });
});

describe('references', () => {
  it('plays the tonic on its own', () => {
    const events = buildTonicReference(makeKey('Eb'), 4);
    expect(events).toHaveLength(1);
    expect(eventNotes(events)).toEqual(['Eb4']);
  });

  it('plays a chord root on its own', () => {
    expect(eventNotes(buildRootReference('F#', 3))).toEqual(['F#3']);
  });

  it('passes the instrument through', () => {
    const [event] = buildTonicReference(makeKey('C'), 4, { instrument: 'flute' });
    expect(event?.kind === 'note' && event.instrument).toBe('flute');
  });
});
