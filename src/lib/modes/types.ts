/**
 * The question generator contract — the second of the three interfaces the spec
 * keeps swappable.
 *
 * A generator is a **pure function of its input**: `{ seed, level, settings }`
 * in, `Question[]` out, no clock and no `Math.random()`. That is what makes the
 * daily challenge work (everyone gets the same questions from the same seed),
 * what makes async head-to-head work (replay the creator's seed), and what
 * makes any of it testable.
 *
 * Every mode in the spec — scale degrees, intervals, chords, progressions,
 * dictation — implements this one interface, so the drill screen in Phase 3
 * never has to know which mode it is running.
 */

import type { AudioEvent } from '../audio/events';
import type { InstrumentId } from '../audio/instruments';
import type { Key } from '../theory/keys';

export const MODE_IDS = [
  'scaleDegrees',
  'intervals',
  'chords',
  'progressions',
  'dictation',
] as const;

export type ModeId = (typeof MODE_IDS)[number];

/** What a session is for. Tests show no feedback and gate the next level. */
export type SessionKind = 'practice' | 'test' | 'daily' | 'challenge' | 'placement' | 'listen';

/**
 * How questions are separated. The spec's "vary the sound" rule: play a short
 * noise or a silence between questions so the previous note can't be used as a
 * pitch reference.
 */
export type SeparatorKind = 'noise' | 'silence';

export const SEPARATOR_SILENCE_MS = 1500;
export const SEPARATOR_NOISE_MS = 400;

/**
 * User- and level-controlled knobs. A generator must behave sensibly when given
 * only the required fields.
 */
export interface GeneratorSettings {
  /** Instruments the drill may use. Rotated per question. */
  instruments: readonly InstrumentId[];
  /** Keys the drill may use. Defaults to the mode's own choice when omitted. */
  keys?: readonly Key[];
  /** Noise or silence between questions. */
  separator?: SeparatorKind;
  /**
   * Whether the key reference (the cadence) plays before every question. This
   * is the *user's* preference; a level may still override it to off, since
   * "no cadence replay" is itself a rung on the scale-degree ladder.
   */
  playReference?: boolean;
  /**
   * How many of the level's answer choices the user has earned, from the
   * learning engine's adaptive rule. Omitted means "all of them" — which is
   * what a level test, the daily challenge and `/dev/sound` want.
   */
  unlockedChoices?: number;
  /** Fix the instrument instead of rotating. Used by `/dev/sound` and Listen mode. */
  fixedInstrument?: InstrumentId;
  /** Fix the key instead of rotating. */
  fixedKey?: Key;
}

export interface GeneratorInput {
  seed: number | string;
  /** 1-based, matching the spec's level ladders. */
  level: number;
  /** How many questions to generate. */
  count: number;
  settings: GeneratorSettings;
  kind?: SessionKind;
  /**
   * `itemKey`s that spaced review says are due. A generator should favour these
   * when it can, so missed items come back sooner.
   */
  dueItemKeys?: readonly string[];
}

export interface AnswerChoice {
  /** Stable id, compared against `Question.correctChoiceId`. */
  id: string;
  /** Primary text, e.g. `3`. */
  label: string;
  /** Secondary text under it, e.g. the solfège `Mi`. */
  sublabel?: string;
  /**
   * Shown but not yet available at this level. The drill dims these — the spec's
   * adaptive-choices rule grows the set as the user masters it.
   */
  locked?: boolean;
}

/**
 * What was rolled for a question. Stored alongside the answer, because the spec
 * records instrument and octave for every answer.
 */
export interface QuestionVoicing {
  instrument: InstrumentId;
  key: Key;
  /** Octave of the tonic (or of the chord root, for chord modes). */
  octave: number;
}

export interface Question {
  /** Unique within its session. */
  id: string;
  mode: ModeId;
  level: number;
  /** The question, e.g. "Which scale degree is that?" */
  promptText: string;
  /** The sound being tested. */
  audio: readonly AudioEvent[];
  /**
   * The cadence, tonic or chord root that frames the question.
   *
   * Always populated, even when it will not be played automatically — the
   * drill's "Replay cadence" button needs something to play, and a level that
   * withholds the cadence is withholding it from the *automatic* playback, not
   * from a user who asks.
   */
  reference: readonly AudioEvent[];
  /**
   * Whether the drill should play `reference` before the question without being
   * asked. False on levels that exist to take the cadence away.
   */
  autoPlayReference: boolean;
  /** Played after this question, before the next. */
  separator: readonly AudioEvent[];
  /** Replayed on answering — the target next to its reference. */
  feedbackAudio: readonly AudioEvent[];
  choices: readonly AnswerChoice[];
  correctChoiceId: string;
  /**
   * Spaced-review key. Identifies *what was tested*, not this particular
   * question — so it is stable across keys, octaves and instruments. Two
   * questions asking about degree `b3` share an `itemKey` and therefore a
   * Leitner box.
   */
  itemKey: string;
  voicing: QuestionVoicing;
}

export interface GeneratedSession {
  mode: ModeId;
  level: number;
  /** The seed as given, so it can be stored and replayed. */
  seed: number | string;
  questions: Question[];
}

export interface Generator {
  mode: ModeId;
  /** Highest level on this mode's ladder. */
  maxLevel: number;
  /** A one-line description of what a level drills, for the Learn tab. */
  levelLabel(level: number): string;
  generate(input: GeneratorInput): GeneratedSession;
}

/** Narrowing helper for ids coming from storage or a URL. */
export function isModeId(value: string): value is ModeId {
  return (MODE_IDS as readonly string[]).includes(value);
}
