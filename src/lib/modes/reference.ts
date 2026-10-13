/**
 * The contract's executable example: a minimal scale-degree generator.
 *
 * It exists so that `Generator` is a thing that demonstrably *works* rather than
 * a type nobody has run — the contract tests drive this, and `/dev/sound` uses
 * it to audition real generated questions. It implements only the bottom three
 * rungs of the spec's scale-degree ladder (`1 vs 5` -> `add 3` -> all seven).
 *
 * **Phase 3 replaces this** with `scaleDegrees.ts`, which carries the full
 * ladder, the adaptive-choice rules and the Leitner weighting. Anything here
 * that Phase 3 still wants should move, not be imported from.
 */

import { concatEvents, type AudioEvent } from '../audio/events';
import { buildCadence, cadenceNotes } from '../theory/cadence';
import { degreeToNote, solfege, type Degree } from '../theory/degrees';
import { MAJOR_KEYS } from '../theory/keys';
import { createSubRng } from '../rng';
import { REFERENCE_INSTRUMENT, rollVoicing, separatorEvents } from './sound';
import type { AnswerChoice, GeneratedSession, Generator, GeneratorInput, Question } from './types';

/** Degrees unlocked at each level. Index 0 is level 1. */
const LEVEL_DEGREES: readonly (readonly Degree[])[] = [
  ['1', '5'],
  ['1', '3', '5'],
  ['1', '2', '3', '4', '5', '6', '7'],
];

const ALL_SHOWN: readonly Degree[] = ['1', '2', '3', '4', '5', '6', '7'];

/**
 * The cadence is fixed at this register rather than following the question's
 * octave: it has to fit `REFERENCE_INSTRUMENT`'s sampled range in all 24 keys,
 * and a key reference does not need to be near the note it frames.
 */
const CADENCE_BASS_OCTAVE = 3;
const CADENCE_WINDOW_LOW = 'D4';

const TARGET_DURATION = 1.2;
/** The question note reaches at most an octave above the tonic. */
const TARGET_SPAN_SEMITONES = 12;

function degreesForLevel(level: number): readonly Degree[] {
  const index = Math.max(0, Math.min(LEVEL_DEGREES.length - 1, level - 1));
  return LEVEL_DEGREES[index] ?? ALL_SHOWN;
}

/** `itemKey` identifies what was tested, not this particular question. */
export function scaleDegreeItemKey(degree: Degree): string {
  return `scaleDegrees:${degree}`;
}

function buildChoices(unlocked: readonly Degree[]): AnswerChoice[] {
  return ALL_SHOWN.map((degree) => ({
    id: degree,
    label: degree,
    sublabel: solfege(degree),
    ...(unlocked.includes(degree) ? {} : { locked: true }),
  }));
}

export const referenceGenerator: Generator = {
  mode: 'scaleDegrees',
  maxLevel: LEVEL_DEGREES.length,

  levelLabel(level: number): string {
    const degrees = degreesForLevel(level);
    return degrees.length === 2
      ? `${degrees[0]} vs ${degrees[1]}`
      : `${degrees.length} degrees: ${degrees.join(' ')}`;
  },

  generate(input: GeneratorInput): GeneratedSession {
    const { seed, level, count, settings } = input;
    const unlocked = degreesForLevel(level);
    const due = new Set(input.dueItemKeys ?? []);
    const playReference = settings.playReference ?? true;

    const questions: Question[] = [];

    for (let index = 0; index < count; index += 1) {
      // One stream per question, keyed by position rather than by draw order,
      // so question 7 is identical whether or not questions 1-6 changed.
      const rng = createSubRng(seed, `q${index}`);

      const voicing = rollVoicing(rng, settings, { above: TARGET_SPAN_SEMITONES }, MAJOR_KEYS);

      // Favour degrees that spaced review says are due.
      const dueDegrees = unlocked.filter((degree) => due.has(scaleDegreeItemKey(degree)));
      const pool = dueDegrees.length > 0 && rng.bool(0.6) ? dueDegrees : unlocked;
      const degree = rng.pick(pool);

      const targetNote = degreeToNote(voicing.key, degree, voicing.octave);
      const tonicNote = degreeToNote(voicing.key, '1', voicing.octave);

      const reference: AudioEvent[] = playReference
        ? buildCadence(voicing.key, {
            bassOctave: CADENCE_BASS_OCTAVE,
            windowLow: CADENCE_WINDOW_LOW,
            instrument: REFERENCE_INSTRUMENT,
          })
        : [];

      const audio: AudioEvent[] = [
        {
          kind: 'note',
          note: targetNote,
          duration: TARGET_DURATION,
          time: 0,
          instrument: voicing.instrument,
        },
      ];

      // Feedback plays the tonic, then the target, so the relationship is
      // audible rather than just named.
      const feedbackAudio = concatEvents(
        [
          {
            kind: 'note',
            note: tonicNote,
            duration: 0.8,
            time: 0,
            instrument: voicing.instrument,
          },
        ],
        audio,
        0.15,
      );

      questions.push({
        id: `${index}-${degree}-${voicing.key.tonic}`,
        mode: 'scaleDegrees',
        level,
        promptText: 'Which scale degree is that?',
        audio,
        reference,
        separator: separatorEvents(settings.separator),
        feedbackAudio,
        choices: buildChoices(unlocked),
        correctChoiceId: degree,
        itemKey: scaleDegreeItemKey(degree),
        voicing,
      });
    }

    return { mode: 'scaleDegrees', level, seed, questions };
  },
};

/** Every note the generator's cadence will sound, for range assertions. */
export function referenceCadenceNotes(key: Parameters<typeof cadenceNotes>[0]): string[] {
  return cadenceNotes(key, {
    bassOctave: CADENCE_BASS_OCTAVE,
    windowLow: CADENCE_WINDOW_LOW,
  });
}
