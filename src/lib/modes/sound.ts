/**
 * The spec's "vary the sound" rule, in one place so every mode obeys it
 * identically:
 *
 * > Rotate instrument and octave, and play a short noise or silence between
 * > questions so the last note can't be used as a reference.
 *
 * The octave part is the fiddly bit. Each instrument is only sampled over part
 * of the range (the flute set has nothing usable below C4), so "a random octave
 * within a safe range" means a random octave *this instrument can actually play
 * every note of this question in* — otherwise a drill would quietly ask the
 * flute for a C3 and the user would hear an obviously stretched sample.
 *
 * Which is also why the **key reference is not rotated**. A I–IV–V–I spans
 * about two octaves once it is voiced, and no single-octave sample set can hold
 * that. The cadence always plays on `REFERENCE_INSTRUMENT` and only the question
 * itself rotates — which is what functional ear-training material does anyway,
 * and has the side benefit of keeping the key reference timbrally constant.
 */

import { getInstrument, type InstrumentId, DEFAULT_INSTRUMENT } from '../audio/instruments';
import type { AudioEvent } from '../audio/events';
import { midiOf, type NoteName } from '../theory/notes';
import type { Key } from '../theory/keys';
import type { PitchClass } from '../theory/notes';
import type { Rng } from '../rng';
import {
  SEPARATOR_NOISE_MS,
  SEPARATOR_SILENCE_MS,
  type GeneratorSettings,
  type QuestionVoicing,
  type SeparatorKind,
} from './types';

/**
 * The instrument that plays cadences and other key references. Piano, for the
 * widest sampled range of the five and the most neutral timbre.
 */
export const REFERENCE_INSTRUMENT: InstrumentId = 'piano';

/** Tonic octaves a drill will consider, low to high. */
const CANDIDATE_OCTAVES = [2, 3, 4, 5, 6] as const;

/** How far a question reaches from its tonic, in semitones. */
export interface OctaveRequest {
  /** Semitones *below* the tonic the question reaches. Usually 0. */
  below?: number;
  /** Semitones *above* the tonic the question reaches. */
  above: number;
}

/**
 * The tonic octaves at which every note of the question fits inside the
 * instrument's sampled range, for this particular tonic.
 *
 * Takes the tonic because the answer genuinely depends on it: B major sits 11
 * semitones higher than C major in the same "octave", which is the difference
 * between fitting the flute's range and not.
 */
export function playableOctaves(
  instrument: InstrumentId,
  request: OctaveRequest,
  tonic: PitchClass,
): number[] {
  const spec = getInstrument(instrument);
  const low = midiOf(spec.range.low);
  const high = midiOf(spec.range.high);
  const below = request.below ?? 0;

  return CANDIDATE_OCTAVES.filter((octave) => {
    const tonicMidi = midiOf(`${tonic}${octave}`);
    return tonicMidi - below >= low && tonicMidi + request.above <= high;
  });
}

/** Instruments that can play the question at some octave in this key. */
export function usableInstruments(
  instruments: readonly InstrumentId[],
  request: OctaveRequest,
  tonic: PitchClass,
): InstrumentId[] {
  return instruments.filter((id) => playableOctaves(id, request, tonic).length > 0);
}

export class NoPlayableVoicingError extends Error {
  constructor(request: OctaveRequest, tonic: PitchClass) {
    super(
      `No allowed instrument can play a question on ${tonic} spanning ${request.below ?? 0} ` +
        `semitones below the tonic and ${request.above} above. Widen the allowed instruments ` +
        `or narrow the level's range.`,
    );
    this.name = 'NoPlayableVoicingError';
  }
}

/**
 * Rolls the key, instrument and octave for one question.
 *
 * Draws in a fixed order — key, then instrument, then octave — because the
 * later choices depend on the earlier ones. Keeping the order fixed is what
 * makes a given `Rng` state always produce the same voicing.
 */
export function rollVoicing(
  rng: Rng,
  settings: GeneratorSettings,
  request: OctaveRequest,
  keys: readonly Key[],
): QuestionVoicing {
  const keyPool = settings.fixedKey ? [settings.fixedKey] : (settings.keys ?? keys);
  if (keyPool.length === 0) throw new Error('rollVoicing needs at least one key');
  const key = rng.pick(keyPool);

  const allowed = settings.fixedInstrument
    ? [settings.fixedInstrument]
    : settings.instruments.length > 0
      ? settings.instruments
      : [DEFAULT_INSTRUMENT];

  const candidates = usableInstruments(allowed, request, key.tonic);
  if (candidates.length === 0) throw new NoPlayableVoicingError(request, key.tonic);

  const instrument = rng.pick(candidates);
  const octave = rng.pick(playableOctaves(instrument, request, key.tonic));

  return { instrument, key, octave };
}

/**
 * The gap between questions. Either a short noise burst or 1.5 s of silence —
 * both exist to stop the previous note working as a pitch reference.
 */
export function separatorEvents(kind: SeparatorKind = 'silence'): AudioEvent[] {
  return kind === 'noise'
    ? [{ kind: 'noise', ms: SEPARATOR_NOISE_MS, time: 0 }]
    : [{ kind: 'rest', ms: SEPARATOR_SILENCE_MS, time: 0 }];
}

/** True when every note sits inside the instrument's sampled range. */
export function notesFitInstrument(notes: readonly NoteName[], instrument: InstrumentId): boolean {
  const spec = getInstrument(instrument);
  const low = midiOf(spec.range.low);
  const high = midiOf(spec.range.high);
  return notes.every((note) => {
    const midi = midiOf(note);
    return midi >= low && midi <= high;
  });
}
