import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  ALL_INSTRUMENTS,
  DEFAULT_INSTRUMENT,
  INSTRUMENTS,
  INSTRUMENT_IDS,
  getInstrument,
  isInstrumentId,
  sampleFileName,
} from './instruments';
import { midiOf } from '../theory/notes';

const SAMPLES_DIR = join(process.cwd(), 'public', 'samples');

describe('the manifest', () => {
  it('covers the five instruments the spec asks for', () => {
    expect(INSTRUMENT_IDS).toEqual([
      'piano',
      'guitar-acoustic',
      'guitar-electric',
      'cello',
      'flute',
    ]);
  });

  it('keys every entry by its own id', () => {
    for (const id of INSTRUMENT_IDS) {
      expect(INSTRUMENTS[id].id).toBe(id);
      expect(getInstrument(id)).toBe(INSTRUMENTS[id]);
    }
  });

  it('labels every instrument', () => {
    for (const spec of ALL_INSTRUMENTS) expect(spec.label).toBeTruthy();
  });

  it('defaults to an instrument that exists', () => {
    expect(INSTRUMENT_IDS).toContain(DEFAULT_INSTRUMENT);
  });

  it('narrows unknown ids', () => {
    expect(isInstrumentId('piano')).toBe(true);
    expect(isInstrumentId('tuba')).toBe(false);
  });
});

describe('sample lists', () => {
  it('names samples in ascending pitch order', () => {
    for (const spec of ALL_INSTRUMENTS) {
      const midis = spec.samples.map(midiOf);
      expect(midis, spec.id).toEqual([...midis].sort((a, b) => a - b));
    }
  });

  it('has no duplicate samples', () => {
    for (const spec of ALL_INSTRUMENTS) {
      expect(new Set(spec.samples).size, spec.id).toBe(spec.samples.length);
    }
  });

  it('never stretches a sample more than three semitones', () => {
    // Beyond about three semitones the timbre shifts audibly, which in an ear
    // trainer is a cue the user could learn instead of the pitch.
    for (const spec of ALL_INSTRUMENTS) {
      const midis = spec.samples.map(midiOf);
      for (let i = 1; i < midis.length; i += 1) {
        const gap = midis[i]! - midis[i - 1]!;
        // Samples sit at the ends of each gap, so the worst stretch is half of it.
        expect(
          Math.ceil(gap / 2),
          `${spec.id} between ${spec.samples[i - 1]} and ${spec.samples[i]}`,
        ).toBeLessThanOrEqual(3);
      }
    }
  });

  it('brackets the declared range with real samples', () => {
    // The range must not extend past the lowest and highest samples, or its
    // edges would be pure pitch-shift.
    for (const spec of ALL_INSTRUMENTS) {
      const midis = spec.samples.map(midiOf);
      expect(midiOf(spec.range.low), `${spec.id} low`).toBeGreaterThanOrEqual(Math.min(...midis));
      expect(midiOf(spec.range.high), `${spec.id} high`).toBeLessThanOrEqual(Math.max(...midis));
    }
  });

  it('declares a range that is the right way round and usefully wide', () => {
    for (const spec of ALL_INSTRUMENTS) {
      const span = midiOf(spec.range.high) - midiOf(spec.range.low);
      expect(span, spec.id).toBeGreaterThanOrEqual(12);
    }
  });
});

describe('sampleFileName', () => {
  it('spells sharps the way the files on disk do', () => {
    expect(sampleFileName('G#3')).toBe('Gs3.mp3');
    expect(sampleFileName('C4')).toBe('C4.mp3');
    expect(sampleFileName('D#5')).toBe('Ds5.mp3');
  });
});

describe('the sample files on disk', () => {
  /**
   * The manifest drives both `scripts/fetch-samples.mjs` and the `Sampler`
   * urls, so a name that is in the manifest but not on disk is a silent 404 at
   * runtime — the instrument simply never loads. This is the check that catches
   * it at build time instead.
   */
  it('exists for every sample in the manifest', () => {
    const missing: string[] = [];
    for (const spec of ALL_INSTRUMENTS) {
      for (const note of spec.samples) {
        const path = join(SAMPLES_DIR, spec.id, sampleFileName(note));
        if (!existsSync(path)) missing.push(`${spec.id}/${sampleFileName(note)}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('is a non-empty file in each case', () => {
    for (const spec of ALL_INSTRUMENTS) {
      for (const note of spec.samples) {
        const path = join(SAMPLES_DIR, spec.id, sampleFileName(note));
        expect(statSync(path).size, `${spec.id}/${note}`).toBeGreaterThan(1000);
      }
    }
  });
});
