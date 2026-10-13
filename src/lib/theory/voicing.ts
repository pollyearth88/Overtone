/**
 * Voicing: turning a chord sequence into pitches that sound like a keyboard
 * player rather than a stack of root-position triads.
 *
 * The rule is the one a first-year harmony student learns — keep the upper
 * voices inside a fixed octave window and move each of them as little as
 * possible. For I–IV–V–I that reproduces the textbook voicing without needing
 * any table of special cases.
 */

import { chordPitchClasses, type ChordQuality } from './chords';
import {
  midiOf,
  noteFromMidi,
  pitchClassAtOrAbove,
  spellAtMidi,
  type NoteName,
  type PitchClass,
} from './notes';

export interface VoicedChord {
  /** The root, played low. */
  bass: NoteName;
  /** The chord tones, ascending, inside the voicing window. */
  upper: NoteName[];
  /** `bass` plus `upper`, ascending — what gets played. */
  notes: NoteName[];
}

export interface ChordRef {
  root: PitchClass;
  quality: ChordQuality;
}

export interface VoiceOptions {
  /** Octave of the bass note. */
  bassOctave?: number;
  /**
   * Bottom of the window the upper voices live in. Each upper voice is placed
   * at or above this, with the lowest inside `[windowLow, windowLow + 12)`.
   */
  windowLow?: NoteName;
}

const DEFAULT_BASS_OCTAVE = 3;
const DEFAULT_WINDOW_LOW = 'D4';

/** One rotation of the chord, stacked ascending from the window floor. */
interface Candidate {
  midis: number[];
  pitchClasses: PitchClass[];
}

function candidatesFor(chord: ChordRef, windowLowMidi: number): Candidate[] {
  const pitchClasses = chordPitchClasses(chord.root, chord.quality);
  const out: Candidate[] = [];

  for (let rotation = 0; rotation < pitchClasses.length; rotation += 1) {
    const order = [...pitchClasses.slice(rotation), ...pitchClasses.slice(0, rotation)];
    const first = order[0];
    if (!first) continue;

    let previous = midiOf(pitchClassAtOrAbove(first, windowLowMidi));
    const midis = [previous];

    for (const pc of order.slice(1)) {
      previous = midiOf(pitchClassAtOrAbove(pc, previous + 1));
      midis.push(previous);
    }

    out.push({ midis, pitchClasses: order });
  }

  return out;
}

/** Total semitone movement between two voicings, voice by voice. */
function motionCost(from: readonly number[], to: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < Math.min(from.length, to.length); i += 1) {
    total += Math.abs((to[i] ?? 0) - (from[i] ?? 0));
  }
  return total;
}

function spell(candidate: Candidate): NoteName[] {
  return candidate.midis.map((midi, index) => {
    const pc = candidate.pitchClasses[index];
    return (pc ? spellAtMidi(pc, midi) : null) ?? noteFromMidi(midi);
  });
}

/**
 * Voices a chord sequence with smooth upper-voice motion.
 *
 * The first chord is the inversion sitting lowest in the window; every chord
 * after it is the inversion closest to the one before.
 */
export function voiceProgression(
  chords: readonly ChordRef[],
  options: VoiceOptions = {},
): VoicedChord[] {
  const bassOctave = options.bassOctave ?? DEFAULT_BASS_OCTAVE;
  const windowLowMidi = midiOf(options.windowLow ?? DEFAULT_WINDOW_LOW);

  const out: VoicedChord[] = [];
  let previous: number[] | null = null;

  for (const chord of chords) {
    const candidates = candidatesFor(chord, windowLowMidi);
    const first = candidates[0];
    if (!first) continue;

    // No previous chord to lead from: measure against the window floor, which
    // picks the inversion that sits lowest.
    const reference = previous ?? first.midis.map(() => windowLowMidi);

    let best = first;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const candidateCost = motionCost(reference, candidate.midis);
      if (candidateCost < bestCost) {
        best = candidate;
        bestCost = candidateCost;
      }
    }

    const bass = `${chord.root}${bassOctave}`;
    const upper = spell(best);
    out.push({ bass, upper, notes: [bass, ...upper] });
    previous = best.midis;
  }

  return out;
}

/** Every pitch in a voiced sequence, for range checks. */
export function voicedNotes(chords: readonly VoicedChord[]): NoteName[] {
  return chords.flatMap((chord) => chord.notes);
}
