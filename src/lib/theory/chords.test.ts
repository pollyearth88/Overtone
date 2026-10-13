import { describe, expect, it } from 'vitest';

import {
  CHORD_QUALITIES,
  CHORD_QUALITY_SPECS,
  EXTENDED_QUALITIES,
  SEVENTH_QUALITIES,
  TRIAD_QUALITIES,
  chordBassOffset,
  chordNotes,
  chordPitchClasses,
  chordQualitySpec,
  chordSize,
  chordSpan,
  chordSymbol,
  inversionLabel,
  isChordQuality,
  maxInversion,
  type ChordQuality,
  type Inversion,
} from './chords';
import { chromaOf, midiOf, pitchClassOf, simplifyNote } from './notes';

describe('chord quality tables', () => {
  it('has a spec for every quality, keyed consistently', () => {
    for (const quality of CHORD_QUALITIES) {
      const spec = chordQualitySpec(quality);
      expect(spec.id).toBe(quality);
      expect(spec.label).toBeTruthy();
      expect(CHORD_QUALITY_SPECS[quality]).toBe(spec);
    }
  });

  it('always starts on the root and ascends', () => {
    for (const quality of CHORD_QUALITIES) {
      const { semitones } = chordQualitySpec(quality);
      expect(semitones[0]).toBe(0);
      for (let i = 1; i < semitones.length; i += 1) {
        expect(semitones[i]!, quality).toBeGreaterThan(semitones[i - 1]!);
      }
    }
  });

  it('sizes triads at 3, sevenths at 4 and ninths at 5', () => {
    for (const quality of TRIAD_QUALITIES) expect(chordSize(quality)).toBe(3);
    for (const quality of SEVENTH_QUALITIES) expect(chordSize(quality)).toBe(4);
    for (const quality of EXTENDED_QUALITIES) expect(chordSize(quality)).toBe(5);
  });

  it('has the intervals the names claim', () => {
    expect(chordQualitySpec('maj').semitones).toEqual([0, 4, 7]);
    expect(chordQualitySpec('min').semitones).toEqual([0, 3, 7]);
    expect(chordQualitySpec('dim').semitones).toEqual([0, 3, 6]);
    expect(chordQualitySpec('aug').semitones).toEqual([0, 4, 8]);
    expect(chordQualitySpec('dom7').semitones).toEqual([0, 4, 7, 10]);
    expect(chordQualitySpec('m7b5').semitones).toEqual([0, 3, 6, 10]);
    expect(chordQualitySpec('dim7').semitones).toEqual([0, 3, 6, 9]);
  });

  it('narrows unknown strings', () => {
    expect(isChordQuality('maj7')).toBe(true);
    expect(isChordQuality('maj13')).toBe(false);
  });
});

describe('chordPitchClasses', () => {
  it('spells the familiar chords the familiar way', () => {
    expect(chordPitchClasses('C', 'maj')).toEqual(['C', 'E', 'G']);
    expect(chordPitchClasses('C', 'min')).toEqual(['C', 'Eb', 'G']);
    expect(chordPitchClasses('C', 'dom7')).toEqual(['C', 'E', 'G', 'Bb']);
    expect(chordPitchClasses('F', 'maj')).toEqual(['F', 'A', 'C']);
  });

  it('keeps the theoretically correct spelling even when it is ugly', () => {
    // A diminished 7th really does have a double-flatted 7th.
    expect(chordPitchClasses('C', 'dim7')).toEqual(['C', 'Eb', 'Gb', 'Bbb']);
  });

  it('returns one pitch class per chord tone, at the right chroma', () => {
    for (const root of ['C', 'F#', 'Bb', 'Eb', 'A']) {
      for (const quality of CHORD_QUALITIES) {
        const pcs = chordPitchClasses(root, quality);
        const { semitones } = chordQualitySpec(quality);
        expect(pcs, `${root}${quality}`).toHaveLength(semitones.length);
        semitones.forEach((offset, index) => {
          expect(chromaOf(pcs[index]!), `${root}${quality}[${index}]`).toBe(
            (chromaOf(root) + offset) % 12,
          );
        });
      }
    }
  });
});

describe('chordNotes', () => {
  it('voices root position ascending from the root', () => {
    expect(chordNotes({ root: 'C', quality: 'maj', octave: 4 })).toEqual(['C4', 'E4', 'G4']);
    expect(chordNotes({ root: 'C', quality: 'dom7', octave: 3 })).toEqual([
      'C3',
      'E3',
      'G3',
      'Bb3',
    ]);
  });

  it('moves the lower voices up an octave for inversions', () => {
    // First inversion of C major puts E in the bass.
    expect(chordNotes({ root: 'C', quality: 'maj', octave: 4, inversion: 1 })).toEqual([
      'E4',
      'G4',
      'C5',
    ]);
    expect(chordNotes({ root: 'C', quality: 'maj', octave: 4, inversion: 2 })).toEqual([
      'G4',
      'C5',
      'E5',
    ]);
  });

  it('always returns ascending pitches, for every quality and inversion', () => {
    for (const root of ['C', 'F#', 'Bb', 'E']) {
      for (const quality of CHORD_QUALITIES) {
        for (let inversion = 0; inversion <= maxInversion(quality); inversion += 1) {
          const notes = chordNotes({
            root,
            quality,
            octave: 4,
            inversion: inversion as Inversion,
          });
          const midis = notes.map(midiOf);
          const sorted = [...midis].sort((a, b) => a - b);
          expect(midis, `${root}${quality} inv${inversion}`).toEqual(sorted);
          expect(new Set(midis).size).toBe(midis.length);
        }
      }
    }
  });

  it('keeps the same set of pitch classes under inversion', () => {
    for (const quality of CHORD_QUALITIES) {
      const root = chordNotes({ root: 'C', quality, octave: 4 });
      const expected = new Set(root.map((note) => chromaOf(pitchClassOf(note))));
      for (let inversion = 1; inversion <= maxInversion(quality); inversion += 1) {
        const inverted = chordNotes({
          root: 'C',
          quality,
          octave: 4,
          inversion: inversion as Inversion,
        });
        const actual = new Set(inverted.map((note) => chromaOf(pitchClassOf(note))));
        expect(actual, `${quality} inv${inversion}`).toEqual(expected);
      }
    }
  });

  it('sounds the pitches the semitone offsets promise', () => {
    for (const quality of CHORD_QUALITIES) {
      const { semitones } = chordQualitySpec(quality);
      const notes = chordNotes({ root: 'C', quality, octave: 4 });
      const rootMidi = midiOf('C4');
      expect(notes.map(midiOf)).toEqual(semitones.map((offset) => rootMidi + offset));
    }
  });

  it('simplifies cleanly for display without changing pitch', () => {
    const notes = chordNotes({ root: 'C', quality: 'dim7', octave: 4 });
    expect(notes).toEqual(['C4', 'Eb4', 'Gb4', 'Bbb4']);
    expect(notes.map(simplifyNote)).toEqual(['C4', 'Eb4', 'Gb4', 'A4']);
    expect(midiOf('Bbb4')).toBe(midiOf('A4'));
  });
});

describe('chordSpan and chordBassOffset', () => {
  it('measures a root-position triad as a fifth', () => {
    expect(chordSpan('maj')).toBe(7);
    expect(chordBassOffset('maj')).toBe(0);
  });

  it('accounts for inversions raising the lower voices', () => {
    // First inversion of C major: E up to the C above, a minor sixth.
    expect(chordSpan('maj', 1)).toBe(8);
    expect(chordBassOffset('maj', 1)).toBe(4);
  });

  it('agrees with the actual voicing it describes', () => {
    for (const quality of CHORD_QUALITIES) {
      for (let inversion = 0; inversion <= maxInversion(quality); inversion += 1) {
        const notes = chordNotes({
          root: 'C',
          quality,
          octave: 4,
          inversion: inversion as Inversion,
        });
        const midis = notes.map(midiOf);
        const rootMidi = midiOf('C4');
        expect(Math.max(...midis) - Math.min(...midis)).toBe(
          chordSpan(quality, inversion as Inversion),
        );
        expect(Math.min(...midis) - rootMidi).toBe(
          chordBassOffset(quality, inversion as Inversion),
        );
      }
    }
  });
});

describe('naming', () => {
  it('builds the usual chord symbols', () => {
    expect(chordSymbol('C', 'maj')).toBe('C');
    expect(chordSymbol('C', 'min')).toBe('Cm');
    expect(chordSymbol('F#', 'dom7')).toBe('F#7');
    expect(chordSymbol('Bb', 'm7b5')).toBe('Bbm7b5');
  });

  it('names inversions', () => {
    expect(inversionLabel(0)).toBe('Root position');
    expect(inversionLabel(1)).toBe('1st inversion');
    expect(inversionLabel(3)).toBe('3rd inversion');
  });

  it('caps inversions at one below the chord size', () => {
    expect(maxInversion('maj')).toBe(2);
    expect(maxInversion('dom7')).toBe(3);
    expect(maxInversion('maj9')).toBe(4);
  });
});

describe('ear-training ladder coverage', () => {
  it('has every quality the spec names', () => {
    const required: ChordQuality[] = ['maj', 'min', 'dim', 'aug', 'maj7', 'dom7', 'min7', 'm7b5'];
    for (const quality of required) {
      expect(CHORD_QUALITIES).toContain(quality);
    }
  });
});
