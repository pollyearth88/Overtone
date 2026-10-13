import { describe, expect, it } from 'vitest';

import {
  NoPlayableVoicingError,
  REFERENCE_INSTRUMENT,
  notesFitInstrument,
  playableOctaves,
  rollVoicing,
  separatorEvents,
  usableInstruments,
} from './sound';
import { SEPARATOR_NOISE_MS, SEPARATOR_SILENCE_MS, type GeneratorSettings } from './types';
import { INSTRUMENT_IDS, getInstrument } from '../audio/instruments';
import { createRng } from '../rng';
import { MAJOR_KEYS, makeKey } from '../theory/keys';
import { midiOf } from '../theory/notes';

const settings = (overrides: Partial<GeneratorSettings> = {}): GeneratorSettings => ({
  instruments: [...INSTRUMENT_IDS],
  ...overrides,
});

describe('playableOctaves', () => {
  it('only returns octaves where the whole question fits the sampled range', () => {
    for (const id of INSTRUMENT_IDS) {
      const spec = getInstrument(id);
      const low = midiOf(spec.range.low);
      const high = midiOf(spec.range.high);

      for (const octave of playableOctaves(id, { above: 12 }, 'C')) {
        const tonic = midiOf(`C${octave}`);
        expect(tonic, `${id} octave ${octave}`).toBeGreaterThanOrEqual(low);
        expect(tonic + 12, `${id} octave ${octave}`).toBeLessThanOrEqual(high);
      }
    }
  });

  it('accounts for the tonic sitting higher in the octave', () => {
    // The flute is sampled C4-C6 (midi 60-84). A one-octave question on C fits
    // at octaves 4 and 5. The same question on B only fits at octave 4: B3 is
    // below the low end, and B5 + an octave is above the high end.
    expect(playableOctaves('flute', { above: 12 }, 'C')).toEqual([4, 5]);
    expect(playableOctaves('flute', { above: 12 }, 'B')).toEqual([4]);
    expect(playableOctaves('flute', { above: 0 }, 'C')).toEqual([4, 5, 6]);
  });

  it('respects notes below the tonic', () => {
    const withoutBelow = playableOctaves('piano', { above: 12 }, 'C');
    const withBelow = playableOctaves('piano', { below: 12, above: 12 }, 'C');
    expect(withBelow.length).toBeLessThan(withoutBelow.length);
    for (const octave of withBelow) {
      expect(midiOf(`C${octave}`) - 12).toBeGreaterThanOrEqual(
        midiOf(getInstrument('piano').range.low),
      );
    }
  });

  it('returns nothing when the question is wider than the instrument', () => {
    // The flute's sampled range is two octaves; a three-octave question cannot fit.
    expect(playableOctaves('flute', { above: 36 }, 'C')).toEqual([]);
  });

  it('gives the piano the most room, as the widest set', () => {
    const counts = INSTRUMENT_IDS.map((id) => playableOctaves(id, { above: 12 }, 'C').length);
    const pianoCount = playableOctaves('piano', { above: 12 }, 'C').length;
    expect(pianoCount).toBe(Math.max(...counts));
  });
});

describe('usableInstruments', () => {
  it('drops instruments that cannot play the question in that key', () => {
    // The flute's sampled range is exactly two octaves, so a question reaching
    // beyond that leaves it out while the piano still copes.
    const usable = usableInstruments([...INSTRUMENT_IDS], { above: 25 }, 'C');
    expect(usable).not.toContain('flute');
    expect(usable).toContain('piano');
  });

  it('keeps all five for a question inside one octave', () => {
    expect(usableInstruments([...INSTRUMENT_IDS], { above: 12 }, 'C')).toHaveLength(5);
  });

  it('never invents an instrument that was not allowed', () => {
    expect(usableInstruments(['flute'], { above: 0 }, 'C')).toEqual(['flute']);
    expect(usableInstruments([], { above: 0 }, 'C')).toEqual([]);
  });
});

describe('rollVoicing', () => {
  it('is deterministic for a seed', () => {
    const roll = () => rollVoicing(createRng('seed'), settings(), { above: 12 }, MAJOR_KEYS);
    expect(roll()).toEqual(roll());
  });

  it('only ever returns a playable instrument/octave/key combination', () => {
    for (let i = 0; i < 400; i += 1) {
      const voicing = rollVoicing(createRng(i), settings(), { above: 12 }, MAJOR_KEYS);
      expect(playableOctaves(voicing.instrument, { above: 12 }, voicing.key.tonic)).toContain(
        voicing.octave,
      );
    }
  });

  it('actually varies the sound across questions', () => {
    const instruments = new Set<string>();
    const octaves = new Set<number>();
    const keys = new Set<string>();
    for (let i = 0; i < 300; i += 1) {
      const voicing = rollVoicing(createRng(`q${i}`), settings(), { above: 12 }, MAJOR_KEYS);
      instruments.add(voicing.instrument);
      octaves.add(voicing.octave);
      keys.add(voicing.key.tonic);
    }
    expect(instruments.size).toBe(5);
    expect(octaves.size).toBeGreaterThan(1);
    expect(keys.size).toBe(12);
  });

  it('honours a fixed instrument', () => {
    for (let i = 0; i < 50; i += 1) {
      const voicing = rollVoicing(
        createRng(i),
        settings({ fixedInstrument: 'cello' }),
        { above: 12 },
        MAJOR_KEYS,
      );
      expect(voicing.instrument).toBe('cello');
    }
  });

  it('honours a fixed key', () => {
    const key = makeKey('Eb');
    for (let i = 0; i < 50; i += 1) {
      const voicing = rollVoicing(
        createRng(i),
        settings({ fixedKey: key }),
        { above: 12 },
        MAJOR_KEYS,
      );
      expect(voicing.key).toEqual(key);
    }
  });

  it('prefers the settings key list over the fallback', () => {
    const only = [makeKey('F')];
    const voicing = rollVoicing(createRng(1), settings({ keys: only }), { above: 12 }, MAJOR_KEYS);
    expect(voicing.key.tonic).toBe('F');
  });

  it('falls back to the default instrument when none are allowed', () => {
    const voicing = rollVoicing(
      createRng(1),
      settings({ instruments: [] }),
      { above: 12 },
      MAJOR_KEYS,
    );
    expect(voicing.instrument).toBe('piano');
  });

  it('throws a named error rather than producing an unplayable question', () => {
    expect(() =>
      rollVoicing(createRng(1), settings({ fixedInstrument: 'flute' }), { above: 36 }, MAJOR_KEYS),
    ).toThrow(NoPlayableVoicingError);
  });

  it('throws when given no keys at all', () => {
    expect(() => rollVoicing(createRng(1), settings({ keys: [] }), { above: 12 }, [])).toThrow();
  });
});

describe('separatorEvents', () => {
  it('defaults to 1.5 s of silence, per the spec', () => {
    const events = separatorEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ kind: 'rest', ms: SEPARATOR_SILENCE_MS, time: 0 });
    expect(SEPARATOR_SILENCE_MS).toBe(1500);
  });

  it('can be a short noise burst instead', () => {
    expect(separatorEvents('noise')).toEqual([{ kind: 'noise', ms: SEPARATOR_NOISE_MS, time: 0 }]);
  });

  it('is shorter as noise than as silence, since noise clears faster', () => {
    expect(SEPARATOR_NOISE_MS).toBeLessThan(SEPARATOR_SILENCE_MS);
  });
});

describe('notesFitInstrument', () => {
  it('checks every note against the sampled range', () => {
    expect(notesFitInstrument(['C4', 'E4', 'G4'], 'flute')).toBe(true);
    expect(notesFitInstrument(['C3'], 'flute')).toBe(false);
    expect(notesFitInstrument(['C4', 'C3'], 'flute')).toBe(false);
  });

  it('treats the range bounds as inclusive', () => {
    const spec = getInstrument('flute');
    expect(notesFitInstrument([spec.range.low, spec.range.high], 'flute')).toBe(true);
  });

  it('is trivially true for no notes', () => {
    expect(notesFitInstrument([], 'flute')).toBe(true);
  });
});

describe('REFERENCE_INSTRUMENT', () => {
  it('is the instrument with the widest sampled range', () => {
    // The cadence spans about two octaves, so the reference instrument has to
    // be the roomiest one available.
    const spans = INSTRUMENT_IDS.map((id) => {
      const spec = getInstrument(id);
      return { id, span: midiOf(spec.range.high) - midiOf(spec.range.low) };
    });
    const widest = spans.reduce((a, b) => (b.span > a.span ? b : a));
    expect(REFERENCE_INSTRUMENT).toBe(widest.id);
  });
});
