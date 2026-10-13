import { describe, expect, it } from 'vitest';

import { voiceProgression, voicedNotes } from './voicing';
import { CHORD_QUALITIES, chordPitchClasses } from './chords';
import { ALL_KEYS, makeKey } from './keys';
import { chromaOf, midiOf, pitchClassOf } from './notes';
import { resolveProgression } from './romanNumerals';

describe('voiceProgression', () => {
  it('produces the textbook I-IV-V-I voicing in C major', () => {
    const chords = resolveProgression(makeKey('C'), ['I', 'IV', 'V', 'I']);
    const voiced = voiceProgression(chords, { bassOctave: 3, windowLow: 'D4' });

    expect(voiced.map((chord) => chord.upper)).toEqual([
      ['E4', 'G4', 'C5'],
      ['F4', 'A4', 'C5'],
      ['G4', 'B4', 'D5'],
      ['G4', 'C5', 'E5'],
    ]);
    expect(voiced.map((chord) => chord.bass)).toEqual(['C3', 'F3', 'G3', 'C3']);
  });

  it('puts the root in the bass at the requested octave', () => {
    const chords = resolveProgression(makeKey('Eb'), ['I', 'IV', 'V', 'I']);
    const voiced = voiceProgression(chords, { bassOctave: 2 });
    expect(voiced.map((c) => c.bass)).toEqual(['Eb2', 'Ab2', 'Bb2', 'Eb2']);
  });

  it('keeps upper voices inside the window', () => {
    for (const key of ALL_KEYS) {
      const numerals = key.mode === 'major' ? ['I', 'IV', 'V', 'I'] : ['i', 'iv', 'V', 'i'];
      const voiced = voiceProgression(resolveProgression(key, numerals), {
        windowLow: 'D4',
      });
      const floor = midiOf('D4');
      for (const chord of voiced) {
        const midis = chord.upper.map(midiOf);
        // Lowest voice sits in the window itself.
        expect(Math.min(...midis), `${key.tonic} ${key.mode}`).toBeGreaterThanOrEqual(floor);
        expect(Math.min(...midis)).toBeLessThan(floor + 12);
        // Stacked ascending above it.
        expect(midis).toEqual([...midis].sort((a, b) => a - b));
      }
    }
  });

  it('moves the upper voices as little as it can', () => {
    const chords = resolveProgression(makeKey('C'), ['I', 'IV', 'V', 'I']);
    const voiced = voiceProgression(chords, { windowLow: 'D4' });

    for (let i = 1; i < voiced.length; i += 1) {
      const from = voiced[i - 1]!.upper.map(midiOf);
      const to = voiced[i]!.upper.map(midiOf);
      const moved = from.reduce((sum, midi, index) => sum + Math.abs((to[index] ?? 0) - midi), 0);
      // Good voice leading on a triad change is a handful of semitones, never a leap.
      expect(moved, `chord ${i}`).toBeLessThanOrEqual(6);
    }
  });

  it('sounds the chord it was given, nothing more or less', () => {
    for (const key of ALL_KEYS) {
      const numerals = key.mode === 'major' ? ['I', 'IV', 'V', 'vi'] : ['i', 'iv', 'V', 'VI'];
      const chords = resolveProgression(key, numerals);
      const voiced = voiceProgression(chords);

      voiced.forEach((chord, index) => {
        const ref = chords[index]!;
        const expected = new Set(
          chordPitchClasses(ref.root, ref.quality).map((pc) => chromaOf(pc)),
        );
        const actual = new Set(chord.upper.map((note) => chromaOf(pitchClassOf(note))));
        expect(actual, `${key.tonic} ${ref.numeral}`).toEqual(expected);
        // The bass doubles the root rather than adding a new pitch class.
        expect(chromaOf(pitchClassOf(chord.bass))).toBe(chromaOf(ref.root));
      });
    }
  });

  it('voices every chord quality without losing a voice', () => {
    for (const quality of CHORD_QUALITIES) {
      const voiced = voiceProgression([{ root: 'C', quality }], { windowLow: 'D4' });
      expect(voiced, quality).toHaveLength(1);
      expect(voiced[0]!.upper).toHaveLength(chordPitchClasses('C', quality).length);
      expect(voiced[0]!.notes).toHaveLength(voiced[0]!.upper.length + 1);
    }
  });

  it('is deterministic', () => {
    const chords = resolveProgression(makeKey('A', 'minor'), ['i', 'iv', 'V', 'i']);
    const a = voiceProgression(chords);
    const b = voiceProgression(chords);
    expect(a).toEqual(b);
  });

  it('returns an empty list for no chords', () => {
    expect(voiceProgression([])).toEqual([]);
  });
});

describe('voicedNotes', () => {
  it('flattens every pitch in order', () => {
    const voiced = voiceProgression(resolveProgression(makeKey('C'), ['I']), {
      bassOctave: 3,
      windowLow: 'D4',
    });
    expect(voicedNotes(voiced)).toEqual(['C3', 'E4', 'G4', 'C5']);
  });
});
