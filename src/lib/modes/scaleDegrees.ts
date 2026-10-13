/**
 * The scale-degree generator — the core of the app.
 *
 * The spec's ladder, one rung per level:
 *
 * | Level | Drills                                              |
 * | ----- | --------------------------------------------------- |
 * | 1     | `1` vs `5`                                          |
 * | 2     | add `3`                                             |
 * | 3     | `1-3-5` + `6`                                       |
 * | 4     | all seven major degrees                             |
 * | 5     | two octaves                                         |
 * | 6     | chromatic notes (all twelve)                        |
 * | 7     | minor keys                                          |
 * | 8     | no cadence replay                                   |
 *
 * Each question plays the cadence, then the target note. Which degrees are
 * *offered* at a level is this module's business; how many of them are currently
 * *unlocked* is the learning engine's (`adaptive.ts`), and arrives as
 * `settings.unlockedChoices`.
 */

import { concatEvents, type AudioEvent } from '../audio/events';
import { buildCadence } from '../theory/cadence';
import {
  CHROMATIC_DEGREES,
  MAJOR_DEGREES,
  NATURAL_MINOR_DEGREES,
  degreeLabel,
  degreeToNote,
  solfege,
  type Degree,
} from '../theory/degrees';
import { MAJOR_KEYS, MINOR_KEYS, type Key } from '../theory/keys';
import { createSubRng, type Rng } from '../rng';
import { REFERENCE_INSTRUMENT, rollVoicing, separatorEvents } from './sound';
import type { AnswerChoice, GeneratedSession, Generator, GeneratorInput, Question } from './types';

export interface LevelSpec {
  level: number;
  label: string;
  /** Degrees this level can ask about, in teaching order. */
  degrees: readonly Degree[];
  /** Keys the level draws from. */
  keys: readonly Key[];
  /** How many octaves above the tonic the target may sit. */
  octaveSpan: 1 | 2;
  /**
   * Whether the cadence replays before every question. Level 8 turns it off:
   * the key is set once at the start of the session and must then be held in
   * the head, which is the whole skill.
   */
  replayCadence: boolean;
}

export const SCALE_DEGREE_LEVELS: readonly LevelSpec[] = [
  {
    level: 1,
    label: '1 vs 5',
    degrees: ['1', '5'],
    keys: MAJOR_KEYS,
    octaveSpan: 1,
    replayCadence: true,
  },
  {
    level: 2,
    label: '1, 3, 5',
    degrees: ['1', '3', '5'],
    keys: MAJOR_KEYS,
    octaveSpan: 1,
    replayCadence: true,
  },
  {
    level: 3,
    label: '1-3-5 + 6',
    degrees: ['1', '3', '5', '6'],
    keys: MAJOR_KEYS,
    octaveSpan: 1,
    replayCadence: true,
  },
  {
    level: 4,
    label: 'All 7 major degrees',
    degrees: MAJOR_DEGREES,
    keys: MAJOR_KEYS,
    octaveSpan: 1,
    replayCadence: true,
  },
  {
    level: 5,
    label: 'Two octaves',
    degrees: MAJOR_DEGREES,
    keys: MAJOR_KEYS,
    octaveSpan: 2,
    replayCadence: true,
  },
  {
    level: 6,
    label: 'Chromatic notes',
    degrees: CHROMATIC_DEGREES,
    keys: MAJOR_KEYS,
    octaveSpan: 2,
    replayCadence: true,
  },
  {
    level: 7,
    label: 'Minor keys',
    degrees: NATURAL_MINOR_DEGREES,
    keys: MINOR_KEYS,
    octaveSpan: 1,
    replayCadence: true,
  },
  {
    level: 8,
    label: 'No cadence replay',
    degrees: MAJOR_DEGREES,
    keys: MAJOR_KEYS,
    octaveSpan: 1,
    replayCadence: false,
  },
];

export const MAX_SCALE_DEGREE_LEVEL = SCALE_DEGREE_LEVELS.length;

/**
 * The cadence register is pinned rather than following the question's octave:
 * it always plays on `REFERENCE_INSTRUMENT`, and has to fit that instrument's
 * sampled range in all 24 keys. A key reference does not need to sit next to
 * the note it frames.
 */
const CADENCE_BASS_OCTAVE = 3;
const CADENCE_WINDOW_LOW = 'D4';

const TARGET_DURATION = 1.3;
/** Gap between the cadence ending and the target note. */
const REFERENCE_GAP = 0.2;

export function levelSpec(level: number): LevelSpec {
  const index = Math.max(1, Math.min(MAX_SCALE_DEGREE_LEVEL, Math.trunc(level))) - 1;
  const spec = SCALE_DEGREE_LEVELS[index];
  if (!spec) throw new Error(`No scale-degree level ${level}`);
  return spec;
}

/** How many answer choices a level has in total — what the adaptive rule counts up to. */
export function levelChoiceCount(level: number): number {
  return levelSpec(level).degrees.length;
}

/**
 * `itemKey` identifies *what was tested*, not this particular question — so it
 * is stable across keys, octaves and instruments, and two questions about `b3`
 * share a Leitner box. The mode is in the key because `item_stats` is keyed by
 * mode and item together.
 */
export function scaleDegreeItemKey(degree: Degree): string {
  return `scaleDegrees:${degree}`;
}

/** The degree an `itemKey` refers to, or `null` if it is not one of ours. */
export function degreeFromItemKey(itemKey: string): string | null {
  const prefix = 'scaleDegrees:';
  return itemKey.startsWith(prefix) ? itemKey.slice(prefix.length) : null;
}

/**
 * The degrees in play: the level's set, trimmed to however many the adaptive
 * rule has unlocked. Always at least two, so a question is always answerable.
 */
export function unlockedDegrees(level: number, unlockedChoices?: number): readonly Degree[] {
  const { degrees } = levelSpec(level);
  if (unlockedChoices === undefined) return degrees;
  const count = Math.max(2, Math.min(degrees.length, Math.trunc(unlockedChoices)));
  return degrees.slice(0, count);
}

/**
 * The answer buttons. Every degree the level will *ever* ask is shown, with the
 * not-yet-earned ones flagged `locked` so the drill can dim them — the spec's
 * "locked ones dimmed". Seeing what is coming is part of the motivation.
 */
export function buildChoices(level: number, unlockedChoices?: number): AnswerChoice[] {
  const { degrees } = levelSpec(level);
  const unlocked = unlockedDegrees(level, unlockedChoices);

  return degrees.map((degree) => ({
    id: degree,
    label: degreeLabel(degree),
    sublabel: solfege(degree),
    ...(unlocked.includes(degree) ? {} : { locked: true }),
  }));
}

/** The cadence for a key, in the pinned reference register. */
export function buildKeyReference(key: Key): AudioEvent[] {
  return buildCadence(key, {
    bassOctave: CADENCE_BASS_OCTAVE,
    windowLow: CADENCE_WINDOW_LOW,
    instrument: REFERENCE_INSTRUMENT,
  });
}

/**
 * Picks the degree to ask, favouring ones spaced review says are due.
 *
 * The 60% weighting is a deliberate compromise: due items need to come back,
 * but a session that only ever asks your three worst degrees is demoralising
 * and stops exercising the rest.
 */
function pickDegree(rng: Rng, available: readonly Degree[], due: ReadonlySet<string>): Degree {
  const dueDegrees = available.filter((degree) => due.has(scaleDegreeItemKey(degree)));
  const pool = dueDegrees.length > 0 && rng.bool(0.6) ? dueDegrees : available;
  return rng.pick(pool);
}

export const scaleDegreesGenerator: Generator = {
  mode: 'scaleDegrees',
  maxLevel: MAX_SCALE_DEGREE_LEVEL,

  levelLabel(level: number): string {
    return levelSpec(level).label;
  },

  generate(input: GeneratorInput): GeneratedSession {
    const { seed, count, settings } = input;
    const spec = levelSpec(input.level);
    const level = spec.level;

    const available = unlockedDegrees(level, settings.unlockedChoices);
    const due = new Set(input.dueItemKeys ?? []);
    const choices = buildChoices(level, settings.unlockedChoices);

    // `settings.playReference` is the user's setting; `spec.replayCadence` is
    // the level's rule. The level wins when it says no — that is the skill
    // being tested — so this is an AND, not an override.
    const replayCadence = (settings.playReference ?? true) && spec.replayCadence;

    const questions: Question[] = [];

    for (let index = 0; index < count; index += 1) {
      // One stream per question position, so question 7 is the same question 7
      // whether the session is 10 questions or 20, and inserting a question
      // does not shift the ones after it.
      const rng = createSubRng(seed, `q${index}`);

      const voicing = rollVoicing(rng, settings, { above: spec.octaveSpan * 12 }, spec.keys);

      const degree = pickDegree(rng, available, due);

      // On a two-octave level the same degree can appear in either octave; the
      // answer is still the degree, which is the point of the level.
      const octaveOffset = spec.octaveSpan === 2 ? rng.int(0, 2) : 0;
      const targetNote = degreeToNote(voicing.key, degree, voicing.octave + octaveOffset);
      const tonicNote = degreeToNote(voicing.key, '1', voicing.octave);

      const reference = buildKeyReference(voicing.key);

      const audio: AudioEvent[] = [
        {
          kind: 'note',
          note: targetNote,
          duration: TARGET_DURATION,
          time: 0,
          instrument: voicing.instrument,
        },
      ];

      // Wrong-answer feedback plays the tonic then the target, so the
      // relationship is audible rather than just named.
      const feedbackAudio = concatEvents(
        [
          {
            kind: 'note',
            note: tonicNote,
            duration: 0.85,
            time: 0,
            instrument: voicing.instrument,
          },
        ],
        audio,
        0.15,
      );

      questions.push({
        id: `q${index}`,
        mode: 'scaleDegrees',
        level,
        promptText: 'Which scale degree is that?',
        audio,
        reference,
        // The cadence plays before every question, except on the level that
        // exists to take it away — where it still sets the key once, on the
        // first question of the session.
        autoPlayReference: replayCadence || index === 0,
        separator: separatorEvents(settings.separator),
        feedbackAudio,
        choices,
        correctChoiceId: degree,
        itemKey: scaleDegreeItemKey(degree),
        voicing,
      });
    }

    return { mode: 'scaleDegrees', level, seed, questions };
  },
};

/** Cadence, then the target — the whole question as one playable sequence. */
export function questionSequence(question: Question): AudioEvent[] {
  if (!question.autoPlayReference || question.reference.length === 0) {
    return [...question.audio];
  }
  return concatEvents(question.reference, question.audio, REFERENCE_GAP);
}

/** Narrows a URL `?level=` value onto the ladder. Anything odd becomes level 1. */
export function parseLevel(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(MAX_SCALE_DEGREE_LEVEL, Math.trunc(parsed)));
}
