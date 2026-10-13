/**
 * The cadence: the I–IV–V–I that establishes a key before a question.
 *
 * This is the single most important piece of the functional-ear-training loop.
 * Everything a scale-degree question means is relative to the key the cadence
 * just set up, so it has to land unambiguously — which is why minor keys get a
 * **major V** (`i–iv–V–i`) rather than the natural-minor `v`. A minor v leaves
 * the key vague; the raised third is what makes the ear commit.
 */

import type { AudioEvent } from '../audio/events';
import type { InstrumentId } from '../audio/instruments';
import { chordSymbol, type ChordQuality } from './chords';
import { resolveNumeral } from './romanNumerals';
import { voiceProgression, voicedNotes, type VoicedChord } from './voicing';
import type { Key } from './keys';
import type { NoteName } from './notes';

/** The four numerals, by mode. */
export const MAJOR_CADENCE = ['I', 'IV', 'V', 'I'] as const;
export const MINOR_CADENCE = ['i', 'iv', 'V(major)', 'i'] as const;

export interface CadenceOptions {
  /** Octave of the bass root. */
  bassOctave?: number;
  /** Bottom of the upper-voice window. */
  windowLow?: NoteName;
  /** Seconds each chord sounds. */
  chordDuration?: number;
  /** Seconds between chord onsets. Shorter than the duration overlaps them. */
  chordSpacing?: number;
  /** Extra seconds of silence after the final chord, before the question. */
  tailSilence?: number;
  instrument?: InstrumentId;
  velocity?: number;
}

const DEFAULTS = {
  bassOctave: 3,
  windowLow: 'D4',
  chordDuration: 0.62,
  chordSpacing: 0.52,
  tailSilence: 0.35,
  velocity: 0.75,
} as const;

export interface CadenceChord {
  numeral: string;
  root: string;
  quality: ChordQuality;
  symbol: string;
}

/** The four chords of the cadence, resolved against the key. */
export function cadenceChords(key: Key): CadenceChord[] {
  const numerals = key.mode === 'major' ? MAJOR_CADENCE : MINOR_CADENCE;
  return numerals.map((numeral) => {
    const resolved = resolveNumeral(key, numeral);
    return {
      numeral,
      root: resolved.root,
      quality: resolved.quality,
      symbol: chordSymbol(resolved.root, resolved.quality),
    };
  });
}

/** The cadence as voiced chords — useful for display and range checks. */
export function cadenceVoicing(key: Key, options: CadenceOptions = {}): VoicedChord[] {
  return voiceProgression(cadenceChords(key), {
    bassOctave: options.bassOctave ?? DEFAULTS.bassOctave,
    windowLow: options.windowLow ?? DEFAULTS.windowLow,
  });
}

/**
 * The cadence as playable events.
 *
 * The last chord is held longer and followed by a short silence, so the key has
 * time to settle before the question note arrives.
 */
export function buildCadence(key: Key, options: CadenceOptions = {}): AudioEvent[] {
  const duration = options.chordDuration ?? DEFAULTS.chordDuration;
  const spacing = options.chordSpacing ?? DEFAULTS.chordSpacing;
  const tail = options.tailSilence ?? DEFAULTS.tailSilence;
  const velocity = options.velocity ?? DEFAULTS.velocity;

  const voiced = cadenceVoicing(key, options);
  const events: AudioEvent[] = voiced.map((chord, index) => ({
    kind: 'chord',
    notes: chord.notes,
    // Let the final tonic ring.
    duration: index === voiced.length - 1 ? duration * 1.6 : duration,
    time: index * spacing,
    velocity,
    ...(options.instrument ? { instrument: options.instrument } : {}),
  }));

  if (tail > 0 && voiced.length > 0) {
    events.push({
      kind: 'rest',
      ms: tail * 1000,
      time: (voiced.length - 1) * spacing + duration * 1.6,
    });
  }

  return events;
}

/** Every pitch the cadence sounds — for checking it fits an instrument's range. */
export function cadenceNotes(key: Key, options: CadenceOptions = {}): NoteName[] {
  return voicedNotes(cadenceVoicing(key, options));
}

export interface ReferenceOptions {
  instrument?: InstrumentId;
  velocity?: number;
  duration?: number;
}

/**
 * The tonic on its own, as the lightest possible key reference. Used by the
 * drill's wrong-answer feedback, which plays the target next to the tonic so
 * the difference is audible.
 */
export function buildTonicReference(
  key: Key,
  octave: number,
  options: ReferenceOptions = {},
): AudioEvent[] {
  return [
    {
      kind: 'note',
      note: `${key.tonic}${octave}`,
      duration: options.duration ?? 0.9,
      time: 0,
      velocity: options.velocity ?? DEFAULTS.velocity,
      ...(options.instrument ? { instrument: options.instrument } : {}),
    },
  ];
}

/**
 * A chord's root on its own. The chord-mode equivalent of the tonic reference.
 */
export function buildRootReference(
  root: string,
  octave: number,
  options: ReferenceOptions = {},
): AudioEvent[] {
  return [
    {
      kind: 'note',
      note: `${root}${octave}`,
      duration: options.duration ?? 0.9,
      time: 0,
      velocity: options.velocity ?? DEFAULTS.velocity,
      ...(options.instrument ? { instrument: options.instrument } : {}),
    },
  ];
}
