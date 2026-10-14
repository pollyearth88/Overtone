/**
 * The scale-degree generator — the core of the app.
 *
 * The spec's ladder, one rung per level:
 *
 * | Level | Drills                       |
 * | ----- | ---------------------------- |
 * | 1     | `1` vs `5`                   |
 * | 2     | add `3`                      |
 * | 3     | `1-3-5` + `6`                |
 * | 4     | all seven major degrees      |
 * | 5     | two octaves                  |
 * | 6     | chromatic notes (all twelve) |
 * | 7     | minor keys                   |
 * | 8     | no cadence replay            |
 *
 * Each question plays the cadence, then the target note.
 *
 * ## How a level starts
 *
 * A level does **not** restart from two arbitrary options. It starts with
 * everything the previous level ended with — mastered degrees carry forward —
 * plus the first new item that level introduces. Arriving at level 6 having
 * mastered level 5 therefore has the seven major degrees already in play and
 * adds `b7`, rather than asking anyone to tell `1` from `b2`.
 *
 * Opening a level manually without having earned the one below it instead gets
 * that level's *starter set*: `1` and `5` — a fifth apart, and the pair the
 * whole functional method is built on — plus the level's first new item.
 *
 * Which degrees a level offers is this module's business; how many are currently
 * unlocked is the learning engine's (`adaptive.ts`).
 */

import { concatEvents, type AudioEvent } from '../audio/events';
import { buildCadence } from '../theory/cadence';
import {
  DEGREE_SEMITONES,
  degreeLabel,
  degreeToNote,
  solfege,
  type Degree,
} from '../theory/degrees';
import { MAJOR_KEYS, MINOR_KEYS, type Key } from '../theory/keys';
import { createSubRng, type Rng } from '../rng';
import { REFERENCE_INSTRUMENT, rollVoicing, separatorEvents } from './sound';
import type { AnswerChoice, GeneratedSession, Generator, GeneratorInput, Question } from './types';

/**
 * The pair any level can fall back to: a perfect fifth apart, so never
 * confusable, and the two degrees the functional method starts from. Every
 * level's set contains both — asserted in the tests.
 */
export const UNIVERSAL_STARTER: readonly Degree[] = ['1', '5'];

/**
 * The order the seven major degrees are earned in: tonic triad first, then `6`
 * (the spec's own third rung), then the leading tone — distinctive because of
 * its pull to the tonic — and the two steps last, since `2` and `4` are the
 * pair most often confused with their neighbours.
 */
const MAJOR_EARNED_ORDER: readonly Degree[] = ['1', '5', '3', '6', '7', '2', '4'];

/**
 * Chromatic degrees, easiest to hardest. `b7` and `b3` are everywhere in blues
 * and minor-key pop; `b6` is next most familiar from natural minor; `#4` is
 * unstable but distinctive; `b2` is both rare in Western music and only a
 * semitone off the tonic, which makes it the hardest of the twelve.
 */
const CHROMATIC_EARNED_ORDER: readonly Degree[] = ['b7', 'b3', 'b6', '#4', 'b2'];

/**
 * Natural-minor degrees in earned order — the re-voicing of
 * `MAJOR_EARNED_ORDER` into minor, which is what carries forward from the major
 * levels (`3` becomes `b3`, `6` becomes `b6`, `7` becomes `b7`).
 */
const MINOR_EARNED_ORDER: readonly Degree[] = ['1', '5', 'b3', 'b6', 'b7', '2', '4'];

export interface LevelSpec {
  level: number;
  label: string;
  /**
   * Degrees carried in from the previous level, in the order they were earned
   * there. For the minor level these are the natural-minor re-voicings of what
   * was mastered in major.
   */
  carried: readonly Degree[];
  /** New at this level, in unlock order — easiest first. */
  introduces: readonly Degree[];
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
    carried: [],
    introduces: ['1', '5'],
    keys: MAJOR_KEYS,
    octaveSpan: 1,
    replayCadence: true,
  },
  {
    level: 2,
    label: '1, 3, 5',
    carried: ['1', '5'],
    introduces: ['3'],
    keys: MAJOR_KEYS,
    octaveSpan: 1,
    replayCadence: true,
  },
  {
    level: 3,
    label: '1-3-5 + 6',
    carried: ['1', '5', '3'],
    introduces: ['6'],
    keys: MAJOR_KEYS,
    octaveSpan: 1,
    replayCadence: true,
  },
  {
    level: 4,
    label: 'All 7 major degrees',
    carried: ['1', '5', '3', '6'],
    introduces: ['7', '2', '4'],
    keys: MAJOR_KEYS,
    octaveSpan: 1,
    replayCadence: true,
  },
  {
    // The new difficulty is range, not vocabulary, so nothing is introduced and
    // the whole set carries forward.
    level: 5,
    label: 'Two octaves',
    carried: MAJOR_EARNED_ORDER,
    introduces: [],
    keys: MAJOR_KEYS,
    octaveSpan: 2,
    replayCadence: true,
  },
  {
    level: 6,
    label: 'Chromatic notes',
    carried: MAJOR_EARNED_ORDER,
    introduces: CHROMATIC_EARNED_ORDER,
    keys: MAJOR_KEYS,
    octaveSpan: 2,
    replayCadence: true,
  },
  {
    // Nine degrees, not twelve: the seven natural-minor ones carried over from
    // major, then the two alterations real minor-key music actually uses — the
    // raised 7th (the leading tone, from harmonic minor) and then the raised
    // 6th (from melodic minor). Level 6 already trains chromatic hearing, and
    // the minor cadence sounds a major V, so the ear has met the leading tone
    // before being asked to name it.
    level: 7,
    label: 'Minor keys',
    carried: MINOR_EARNED_ORDER,
    introduces: ['7', '6'],
    keys: MINOR_KEYS,
    octaveSpan: 1,
    replayCadence: true,
  },
  {
    // Again no new vocabulary: the skill is holding the key without the cadence.
    level: 8,
    label: 'No cadence replay',
    carried: MAJOR_EARNED_ORDER,
    introduces: [],
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

/**
 * Seconds between the cadence ending and the target note: long enough for the
 * key to settle, short enough that the two still feel like one phrase. A user
 * setting — `drillStore` owns the live value, this is only the fallback.
 */
export const DEFAULT_CADENCE_GAP_SECONDS = 0.55;

export function levelSpec(level: number): LevelSpec {
  const index = Math.max(1, Math.min(MAX_SCALE_DEGREE_LEVEL, Math.trunc(level))) - 1;
  const spec = SCALE_DEGREE_LEVELS[index];
  if (!spec) throw new Error(`No scale-degree level ${level}`);
  return spec;
}

/** Everything the level can ask, in ascending pitch order — the answer grid's order. */
export function levelDegrees(level: number): Degree[] {
  const spec = levelSpec(level);
  return [...spec.carried, ...spec.introduces].sort(
    (a, b) => DEGREE_SEMITONES[a] - DEGREE_SEMITONES[b],
  );
}

/** How many answer choices a level has in total — what the adaptive rule counts up to. */
export function levelChoiceCount(level: number): number {
  return levelDegrees(level).length;
}

/**
 * Whether arriving at this level carries the previous level's degrees forward:
 * true when the level below has been mastered, and trivially true for level 1.
 */
export function carriesForwardInto(level: number, masteredLevels: readonly number[]): boolean {
  if (level <= 1) return true;
  return masteredLevels.includes(level - 1);
}

/** `1`, `5` and the level's first new item, de-duplicated. */
function starterSet(spec: LevelSpec): Degree[] {
  const full = [...spec.carried, ...spec.introduces];
  return [
    ...new Set<Degree>([
      ...UNIVERSAL_STARTER.filter((degree) => full.includes(degree)),
      ...spec.introduces.slice(0, 1),
    ]),
  ];
}

/**
 * The order degrees become available at a level.
 *
 * Earned it properly: everything carried forward, then the new items. Opened it
 * cold: the starter set, then everything else — carried degrees before new
 * ones, since the carried ones are by construction the easier half.
 */
export function levelUnlockOrder(level: number, carriedForward: boolean): Degree[] {
  const spec = levelSpec(level);
  const full = [...spec.carried, ...spec.introduces];
  if (carriedForward) return full;

  const starter = starterSet(spec);
  return [...starter, ...full.filter((degree) => !starter.includes(degree))];
}

/**
 * How many choices a level opens with. Never fewer than two — a question needs
 * something to choose between — and never more than the level has.
 */
export function levelStarterCount(level: number, carriedForward: boolean): number {
  const spec = levelSpec(level);
  const total = levelChoiceCount(level);

  if (!carriedForward) return Math.max(2, Math.min(total, starterSet(spec).length));

  // Everything carried over, plus the first new item.
  const carriedPlusOne = spec.carried.length + (spec.introduces.length > 0 ? 1 : 0);
  return Math.max(2, Math.min(total, carriedPlusOne));
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
 * The degrees in play: the first `unlockedChoices` of the level's unlock order,
 * never fewer than the level's starter set.
 *
 * `unlockedChoices` is stored as a count (mirroring the spec's `skill_progress`
 * column) and the set is derived here, so one place decides what a given amount
 * of progress actually unlocks.
 */
export function unlockedDegrees(
  level: number,
  unlockedChoices?: number,
  carriedForward = true,
): Degree[] {
  const order = levelUnlockOrder(level, carriedForward);
  if (unlockedChoices === undefined) return order;
  const floor = levelStarterCount(level, carriedForward);
  const count = Math.max(floor, Math.min(order.length, Math.trunc(unlockedChoices)));
  return order.slice(0, count);
}

/** The ids a session should treat as unlocked, for `GeneratorSettings`. */
export function unlockedChoiceIds(
  level: number,
  unlockedChoices?: number,
  carriedForward = true,
): string[] {
  return unlockedDegrees(level, unlockedChoices, carriedForward);
}

/**
 * The answer buttons, in ascending pitch order.
 *
 * Every degree the level will *ever* ask is shown, with the not-yet-earned ones
 * flagged `locked` so the drill can dim them — the spec's "locked ones dimmed".
 * Seeing what is coming is part of the motivation.
 */
export function buildChoices(level: number, unlocked?: readonly string[]): AnswerChoice[] {
  return levelDegrees(level).map((degree) => ({
    id: degree,
    label: degreeLabel(degree),
    sublabel: solfege(degree),
    ...(unlocked === undefined || unlocked.includes(degree) ? {} : { locked: true }),
  }));
}

/**
 * The cadence for a key, in the pinned reference register.
 *
 * Built with no trailing silence of its own: the gap before the target note is
 * a user setting applied by `questionSequence`, and splitting it across two
 * places would make that setting lie about its own value.
 */
export function buildKeyReference(key: Key): AudioEvent[] {
  return buildCadence(key, {
    bassOctave: CADENCE_BASS_OCTAVE,
    windowLow: CADENCE_WINDOW_LOW,
    instrument: REFERENCE_INSTRUMENT,
    tailSilence: 0,
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

    const all = levelDegrees(level);
    const unlocked = settings.unlockedChoiceIds;
    const available = unlocked ? all.filter((degree) => unlocked.includes(degree)) : [...all];

    // `unlockedDegrees` enforces a floor of two, so this should be unreachable
    // — but a session with nothing to ask would be worse than a loud failure.
    if (available.length === 0) {
      throw new Error(`Level ${level} has no unlocked degrees to ask about`);
    }

    const due = new Set(input.dueItemKeys ?? []);
    const choices = buildChoices(level, unlocked);

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
export function questionSequence(
  question: Question,
  gapSeconds: number = DEFAULT_CADENCE_GAP_SECONDS,
): AudioEvent[] {
  if (!question.autoPlayReference || question.reference.length === 0) {
    return [...question.audio];
  }
  return concatEvents(question.reference, question.audio, Math.max(0, gapSeconds));
}

/** Narrows a URL `?level=` value onto the ladder. Anything odd becomes level 1. */
export function parseLevel(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.max(1, Math.min(MAX_SCALE_DEGREE_LEVEL, Math.trunc(parsed)));
}
