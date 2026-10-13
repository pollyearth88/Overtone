/**
 * The scale-degree generator, and with it the generator contract.
 *
 * The two properties the whole design rests on are asserted here, inherited
 * from the Phase 2 contract tests: **the same seed gives the same questions**,
 * and **every note is inside the range of the instrument chosen to play it**.
 */

import { describe, expect, it } from 'vitest';

import {
  MAX_SCALE_DEGREE_LEVEL,
  SCALE_DEGREE_LEVELS,
  buildChoices,
  buildKeyReference,
  degreeFromItemKey,
  levelChoiceCount,
  levelSpec,
  parseLevel,
  questionSequence,
  scaleDegreeItemKey,
  scaleDegreesGenerator,
  unlockedDegrees,
} from './scaleDegrees';
import { REFERENCE_INSTRUMENT, notesFitInstrument } from './sound';
import { SEPARATOR_SILENCE_MS, type GeneratorInput, type GeneratorSettings } from './types';
import { eventNotes, sequenceDuration } from '../audio/events';
import { INSTRUMENT_IDS, getInstrument } from '../audio/instruments';
import {
  CHROMATIC_DEGREES,
  MAJOR_DEGREES,
  NATURAL_MINOR_DEGREES,
  degreeLabel,
  isDegree,
  noteToDegree,
  solfege,
  type Degree,
} from '../theory/degrees';
import { midiOf } from '../theory/notes';

const settings = (overrides: Partial<GeneratorSettings> = {}): GeneratorSettings => ({
  instruments: [...INSTRUMENT_IDS],
  ...overrides,
});

const input = (overrides: Partial<GeneratorInput> = {}): GeneratorInput => ({
  seed: 'phase-3',
  level: 4,
  count: 20,
  settings: settings(),
  ...overrides,
});

const ALL_LEVELS = SCALE_DEGREE_LEVELS.map((spec) => spec.level);

describe('the ladder matches the spec', () => {
  it('has the eight rungs the spec lists', () => {
    expect(MAX_SCALE_DEGREE_LEVEL).toBe(8);
    expect(scaleDegreesGenerator.maxLevel).toBe(8);
  });

  it('is numbered 1-8 in order', () => {
    expect(ALL_LEVELS).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('walks 1-vs-5 → add 3 → +6 → all seven', () => {
    expect(levelSpec(1).degrees).toEqual(['1', '5']);
    expect(levelSpec(2).degrees).toEqual(['1', '3', '5']);
    expect(levelSpec(3).degrees).toEqual(['1', '3', '5', '6']);
    expect(levelSpec(4).degrees).toEqual([...MAJOR_DEGREES]);
  });

  it('opens a second octave at level 5', () => {
    expect(levelSpec(4).octaveSpan).toBe(1);
    expect(levelSpec(5).octaveSpan).toBe(2);
  });

  it('adds the chromatic degrees at level 6', () => {
    expect(levelSpec(6).degrees).toEqual([...CHROMATIC_DEGREES]);
    expect(levelSpec(6).degrees).toHaveLength(12);
  });

  it('switches to minor keys at level 7', () => {
    expect(levelSpec(7).degrees).toEqual([...NATURAL_MINOR_DEGREES]);
    expect(levelSpec(7).keys.every((key) => key.mode === 'minor')).toBe(true);
  });

  it('takes the cadence replay away at level 8, and only there', () => {
    for (const level of ALL_LEVELS) {
      expect(levelSpec(level).replayCadence, `level ${level}`).toBe(level !== 8);
    }
  });

  it('only ever grows the degree set, rung by rung, through level 4', () => {
    for (let level = 2; level <= 4; level += 1) {
      const previous = levelSpec(level - 1).degrees;
      const current = levelSpec(level).degrees;
      expect(current.length).toBeGreaterThan(previous.length);
      // Everything already learned is still in play.
      for (const degree of previous) expect(current).toContain(degree);
    }
  });

  it('labels every level', () => {
    for (const level of ALL_LEVELS) {
      expect(scaleDegreesGenerator.levelLabel(level)).toBeTruthy();
    }
  });

  it('clamps levels off the end of the ladder instead of throwing', () => {
    expect(levelSpec(0).level).toBe(1);
    expect(levelSpec(99).level).toBe(8);
    expect(levelSpec(2.7).level).toBe(2);
  });
});

describe('parseLevel', () => {
  it('reads a level from a URL value', () => {
    expect(parseLevel('3')).toBe(3);
  });

  it('clamps onto the ladder', () => {
    expect(parseLevel('0')).toBe(1);
    expect(parseLevel('99')).toBe(8);
  });

  it('falls back to level 1 for nonsense', () => {
    expect(parseLevel(undefined)).toBe(1);
    expect(parseLevel('abc')).toBe(1);
    expect(parseLevel('')).toBe(1);
  });
});

describe('unlockedDegrees and buildChoices', () => {
  it('trims the level set to what has been earned', () => {
    expect(unlockedDegrees(4, 2)).toEqual(['1', '2']);
    expect(unlockedDegrees(4, 5)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('returns the whole set when nothing is specified — tests and the daily', () => {
    expect(unlockedDegrees(4)).toEqual([...MAJOR_DEGREES]);
  });

  it('never drops below two, so a question is always answerable', () => {
    expect(unlockedDegrees(4, 0)).toHaveLength(2);
    expect(unlockedDegrees(4, 1)).toHaveLength(2);
    expect(unlockedDegrees(4, -5)).toHaveLength(2);
  });

  it('never exceeds the level set', () => {
    expect(unlockedDegrees(1, 99)).toEqual(['1', '5']);
  });

  it('shows every degree the level will ask, dimming the unearned ones', () => {
    const choices = buildChoices(4, 3);
    expect(choices).toHaveLength(7);
    expect(choices.filter((choice) => !choice.locked).map((choice) => choice.id)).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(choices.filter((choice) => choice.locked)).toHaveLength(4);
  });

  it('labels choices with the degree and its solfège', () => {
    for (const choice of buildChoices(6)) {
      expect(isDegree(choice.id)).toBe(true);
      expect(choice.label).toBe(degreeLabel(choice.id as Degree));
      expect(choice.sublabel).toBe(solfege(choice.id as Degree));
    }
  });

  it('counts choices per level', () => {
    expect(levelChoiceCount(1)).toBe(2);
    expect(levelChoiceCount(4)).toBe(7);
    expect(levelChoiceCount(6)).toBe(12);
  });
});

describe('itemKey', () => {
  it('names what was tested, not the question', () => {
    expect(scaleDegreeItemKey('b3')).toBe('scaleDegrees:b3');
  });

  it('round-trips', () => {
    for (const degree of CHROMATIC_DEGREES) {
      expect(degreeFromItemKey(scaleDegreeItemKey(degree))).toBe(degree);
    }
  });

  it('ignores keys from another mode', () => {
    expect(degreeFromItemKey('intervals:P5')).toBeNull();
  });

  it('is distinct per degree, so Leitner boxes do not collide', () => {
    const keys = CHROMATIC_DEGREES.map(scaleDegreeItemKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('the same seed gives the same questions', () => {
  it('is byte-for-byte reproducible', () => {
    expect(scaleDegreesGenerator.generate(input())).toEqual(
      scaleDegreesGenerator.generate(input()),
    );
  });

  it('differs between seeds', () => {
    const a = scaleDegreesGenerator.generate(input({ seed: 'a' }));
    const b = scaleDegreesGenerator.generate(input({ seed: 'b' }));
    expect(a.questions).not.toEqual(b.questions);
  });

  it('is stable question-by-question regardless of session length', () => {
    const short = scaleDegreesGenerator.generate(input({ count: 10 }));
    const long = scaleDegreesGenerator.generate(input({ count: 20 }));
    expect(long.questions.slice(0, 10)).toEqual(short.questions);
  });

  it('does not depend on what was generated before', () => {
    const first = scaleDegreesGenerator.generate(input({ seed: 'x' }));
    scaleDegreesGenerator.generate(input({ seed: 'noise-1' }));
    scaleDegreesGenerator.generate(input({ seed: 'noise-2' }));
    expect(scaleDegreesGenerator.generate(input({ seed: 'x' }))).toEqual(first);
  });

  it('never calls Math.random', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('a generator called Math.random');
    };
    try {
      for (const level of ALL_LEVELS) {
        expect(() => scaleDegreesGenerator.generate(input({ level }))).not.toThrow();
      }
    } finally {
      Math.random = original;
    }
  });

  it('is reproducible at every level', () => {
    for (const level of ALL_LEVELS) {
      expect(scaleDegreesGenerator.generate(input({ level }))).toEqual(
        scaleDegreesGenerator.generate(input({ level })),
      );
    }
  });
});

describe('notes are always in range', () => {
  it('plays the question on an instrument that can reach it, at every level', () => {
    for (const level of ALL_LEVELS) {
      for (const seed of ['a', 'b', 'c', 1, 2]) {
        const { questions } = scaleDegreesGenerator.generate(input({ level, seed, count: 25 }));
        for (const question of questions) {
          const notes = eventNotes(question.audio);
          expect(
            notesFitInstrument(notes, question.voicing.instrument),
            `level ${level} seed ${seed}: ${notes.join(',')} on ${question.voicing.instrument}`,
          ).toBe(true);
        }
      }
    }
  });

  it('keeps the cadence inside the reference instrument, at every level', () => {
    for (const level of ALL_LEVELS) {
      const { questions } = scaleDegreesGenerator.generate(input({ level, count: 20 }));
      for (const question of questions) {
        const notes = eventNotes(question.reference);
        expect(notes.length).toBeGreaterThan(0);
        expect(notesFitInstrument(notes, REFERENCE_INSTRUMENT), `level ${level}`).toBe(true);
      }
    }
  });

  it('keeps feedback audio in range', () => {
    for (const level of ALL_LEVELS) {
      const { questions } = scaleDegreesGenerator.generate(input({ level, count: 20 }));
      for (const question of questions) {
        expect(
          notesFitInstrument(eventNotes(question.feedbackAudio), question.voicing.instrument),
        ).toBe(true);
      }
    }
  });

  it('holds when a single instrument is forced', () => {
    // The guarantee is that notes fit *whatever instrument was chosen*, not
    // that the preference is always honoured — see the fallback test below.
    for (const instrument of INSTRUMENT_IDS) {
      for (const level of ALL_LEVELS) {
        const { questions } = scaleDegreesGenerator.generate(
          input({ level, count: 15, settings: settings({ fixedInstrument: instrument }) }),
        );
        for (const question of questions) {
          expect(
            notesFitInstrument(eventNotes(question.audio), question.voicing.instrument),
            `${instrument} level ${level}`,
          ).toBe(true);
        }
      }
    }
  });

  it('honours a forced instrument whenever it can actually play the level', () => {
    for (const instrument of INSTRUMENT_IDS) {
      // One octave in major keys is within every instrument's range.
      const { questions } = scaleDegreesGenerator.generate(
        input({ level: 4, count: 15, settings: settings({ fixedInstrument: instrument }) }),
      );
      for (const question of questions) {
        expect(question.voicing.instrument).toBe(instrument);
      }
    }
  });

  it('falls back to a wider instrument rather than failing the question', () => {
    // The flute is sampled over exactly two octaves, so it cannot cover a
    // two-octave question in most keys. Degrading to another instrument is the
    // right trade — a crashed session would be far worse than an unexpected timbre.
    const { questions } = scaleDegreesGenerator.generate(
      input({ level: 5, count: 20, settings: settings({ fixedInstrument: 'flute' }) }),
    );
    expect(questions).toHaveLength(20);
    for (const question of questions) {
      expect(notesFitInstrument(eventNotes(question.audio), question.voicing.instrument)).toBe(
        true,
      );
    }
    // And it really did have to substitute at least sometimes.
    expect(questions.some((question) => question.voicing.instrument !== 'flute')).toBe(true);
  });

  it('never strays outside the declared range, even by a semitone', () => {
    for (const level of ALL_LEVELS) {
      const { questions } = scaleDegreesGenerator.generate(input({ level, count: 40 }));
      for (const question of questions) {
        const spec = getInstrument(question.voicing.instrument);
        for (const note of eventNotes(question.audio)) {
          expect(midiOf(note)).toBeGreaterThanOrEqual(midiOf(spec.range.low));
          expect(midiOf(note)).toBeLessThanOrEqual(midiOf(spec.range.high));
        }
      }
    }
  });
});

describe('the question asks what it claims to', () => {
  it('sounds exactly the degree named by the correct answer', () => {
    for (const level of ALL_LEVELS) {
      const { questions } = scaleDegreesGenerator.generate(input({ level, count: 30 }));
      for (const question of questions) {
        const notes = eventNotes(question.audio);
        expect(notes).toHaveLength(1);
        expect(noteToDegree(question.voicing.key, notes[0]!), `level ${level}`).toBe(
          question.correctChoiceId,
        );
      }
    }
  });

  it('only asks about degrees the level offers', () => {
    for (const level of ALL_LEVELS) {
      const offered = levelSpec(level).degrees;
      const { questions } = scaleDegreesGenerator.generate(input({ level, count: 40 }));
      for (const question of questions) {
        expect(offered, `level ${level}`).toContain(question.correctChoiceId);
      }
    }
  });

  it('only asks about unlocked degrees when choices are limited', () => {
    const { questions } = scaleDegreesGenerator.generate(
      input({ level: 4, count: 40, settings: settings({ unlockedChoices: 3 }) }),
    );
    for (const question of questions) {
      expect(['1', '2', '3']).toContain(question.correctChoiceId);
    }
  });

  it('uses the whole unlocked set over a long session', () => {
    const { questions } = scaleDegreesGenerator.generate(input({ level: 4, count: 80 }));
    expect(new Set(questions.map((question) => question.correctChoiceId)).size).toBe(7);
  });

  it("uses the level's keys", () => {
    for (const level of ALL_LEVELS) {
      const expected = levelSpec(level).keys[0]?.mode;
      const { questions } = scaleDegreesGenerator.generate(input({ level, count: 20 }));
      for (const question of questions) {
        expect(question.voicing.key.mode, `level ${level}`).toBe(expected);
      }
    }
  });

  it('always has the correct answer among the choices, and unlocked', () => {
    for (const level of ALL_LEVELS) {
      for (const unlockedChoices of [2, 3, 7, undefined]) {
        const { questions } = scaleDegreesGenerator.generate(
          input({ level, count: 20, settings: settings({ unlockedChoices }) }),
        );
        for (const question of questions) {
          const correct = question.choices.find((choice) => choice.id === question.correctChoiceId);
          expect(correct, `level ${level}`).toBeDefined();
          expect(correct?.locked).toBeFalsy();
        }
      }
    }
  });

  it('gives every question a unique id and a stable itemKey', () => {
    const { questions } = scaleDegreesGenerator.generate(input({ count: 20 }));
    expect(new Set(questions.map((question) => question.id)).size).toBe(20);
    for (const question of questions) {
      expect(question.itemKey).toBe(scaleDegreeItemKey(question.correctChoiceId as Degree));
    }
  });
});

describe('two-octave levels', () => {
  it('spread the target across both octaves', () => {
    const { questions } = scaleDegreesGenerator.generate(input({ level: 5, count: 60 }));
    const offsets = new Set(
      questions.map((question) => {
        const tonic = midiOf(`${question.voicing.key.tonic}${question.voicing.octave}`);
        return Math.floor((midiOf(eventNotes(question.audio)[0]!) - tonic) / 12);
      }),
    );
    expect(offsets).toEqual(new Set([0, 1]));
  });

  it('keep the target within two octaves above the tonic', () => {
    const { questions } = scaleDegreesGenerator.generate(input({ level: 5, count: 40 }));
    for (const question of questions) {
      const tonic = midiOf(`${question.voicing.key.tonic}${question.voicing.octave}`);
      const target = midiOf(eventNotes(question.audio)[0]!);
      expect(target).toBeGreaterThanOrEqual(tonic);
      expect(target - tonic).toBeLessThanOrEqual(24);
    }
  });

  it('keep the answer the degree regardless of octave', () => {
    const { questions } = scaleDegreesGenerator.generate(input({ level: 5, count: 40 }));
    for (const question of questions) {
      expect(noteToDegree(question.voicing.key, eventNotes(question.audio)[0]!)).toBe(
        question.correctChoiceId,
      );
    }
  });

  it('keep the single-octave levels to one octave', () => {
    const { questions } = scaleDegreesGenerator.generate(input({ level: 4, count: 40 }));
    for (const question of questions) {
      const tonic = midiOf(`${question.voicing.key.tonic}${question.voicing.octave}`);
      expect(midiOf(eventNotes(question.audio)[0]!) - tonic).toBeLessThanOrEqual(12);
    }
  });
});

describe('the cadence', () => {
  it('plays automatically on every question below level 8', () => {
    for (const level of [1, 2, 3, 4, 5, 6, 7]) {
      const { questions } = scaleDegreesGenerator.generate(input({ level, count: 10 }));
      for (const question of questions) {
        expect(question.autoPlayReference, `level ${level}`).toBe(true);
      }
    }
  });

  it('plays only on the first question at level 8', () => {
    const { questions } = scaleDegreesGenerator.generate(input({ level: 8, count: 10 }));
    expect(questions[0]?.autoPlayReference).toBe(true);
    for (const question of questions.slice(1)) {
      expect(question.autoPlayReference).toBe(false);
    }
  });

  it('is still available to replay at level 8, even when not auto-played', () => {
    // The level withholds the cadence from automatic playback, not from a user
    // who asks for it.
    const { questions } = scaleDegreesGenerator.generate(input({ level: 8, count: 5 }));
    for (const question of questions) {
      expect(question.reference.length).toBeGreaterThan(0);
    }
  });

  it('respects the user turning the reference off', () => {
    const { questions } = scaleDegreesGenerator.generate(
      input({ level: 4, count: 5, settings: settings({ playReference: false }) }),
    );
    expect(questions[0]?.autoPlayReference).toBe(true);
    for (const question of questions.slice(1)) {
      expect(question.autoPlayReference).toBe(false);
    }
  });

  it('plays on the reference instrument, not the rotating one', () => {
    const { questions } = scaleDegreesGenerator.generate(input({ count: 20 }));
    for (const question of questions) {
      for (const event of question.reference) {
        if (event.kind === 'chord') expect(event.instrument).toBe(REFERENCE_INSTRUMENT);
      }
    }
  });

  it('frames the same key the question is in', () => {
    const { questions } = scaleDegreesGenerator.generate(input({ count: 20 }));
    for (const question of questions) {
      expect(eventNotes(question.reference)).toEqual(
        eventNotes(buildKeyReference(question.voicing.key)),
      );
    }
  });
});

describe('questionSequence', () => {
  it('plays the cadence then the target', () => {
    const [question] = scaleDegreesGenerator.generate(input({ count: 1 })).questions;
    const sequence = questionSequence(question!);
    expect(eventNotes(sequence)).toEqual([
      ...eventNotes(question!.reference),
      ...eventNotes(question!.audio),
    ]);
  });

  it('puts the target after the cadence in time', () => {
    const [question] = scaleDegreesGenerator.generate(input({ count: 1 })).questions;
    const sequence = questionSequence(question!);
    const target = sequence[sequence.length - 1];
    expect(target?.time).toBeGreaterThan(sequenceDuration(question!.reference) - 0.01);
  });

  it('plays only the target when the cadence is not auto-played', () => {
    const { questions } = scaleDegreesGenerator.generate(input({ level: 8, count: 5 }));
    const later = questions[3]!;
    expect(questionSequence(later)).toEqual([...later.audio]);
  });

  it('keeps a question short enough for a five-minute session', () => {
    const { questions } = scaleDegreesGenerator.generate(input({ count: 20 }));
    for (const question of questions) {
      expect(sequenceDuration(questionSequence(question))).toBeLessThan(8);
    }
  });
});

describe('separators', () => {
  it('default to 1.5 s of silence', () => {
    const { questions } = scaleDegreesGenerator.generate(input({ count: 3 }));
    for (const question of questions) {
      expect(question.separator).toEqual([{ kind: 'rest', ms: SEPARATOR_SILENCE_MS, time: 0 }]);
    }
  });

  it('can be a noise burst instead', () => {
    const { questions } = scaleDegreesGenerator.generate(
      input({ count: 3, settings: settings({ separator: 'noise' }) }),
    );
    for (const question of questions) {
      expect(question.separator[0]?.kind).toBe('noise');
    }
  });
});

describe('spaced review', () => {
  it('favours due degrees without asking them exclusively', () => {
    const { questions } = scaleDegreesGenerator.generate(
      input({ level: 4, count: 60, dueItemKeys: [scaleDegreeItemKey('4')] }),
    );
    const asked = questions.map((question) => question.correctChoiceId);
    expect(asked.filter((degree) => degree === '4').length).toBeGreaterThan(60 / 7);
    expect(new Set(asked).size).toBeGreaterThan(1);
  });

  it('ignores due degrees the level does not offer', () => {
    const { questions } = scaleDegreesGenerator.generate(
      input({ level: 1, count: 20, dueItemKeys: [scaleDegreeItemKey('b7')] }),
    );
    for (const question of questions) {
      expect(['1', '5']).toContain(question.correctChoiceId);
    }
  });

  it('ignores due degrees that are locked', () => {
    const { questions } = scaleDegreesGenerator.generate(
      input({
        level: 4,
        count: 30,
        dueItemKeys: [scaleDegreeItemKey('7')],
        settings: settings({ unlockedChoices: 2 }),
      }),
    );
    for (const question of questions) {
      expect(['1', '2']).toContain(question.correctChoiceId);
    }
  });

  it('stays reproducible with due items in play', () => {
    const dueItemKeys = [scaleDegreeItemKey('2'), scaleDegreeItemKey('6')];
    expect(scaleDegreesGenerator.generate(input({ dueItemKeys }))).toEqual(
      scaleDegreesGenerator.generate(input({ dueItemKeys })),
    );
  });
});

describe('session shape', () => {
  it('echoes mode, level and seed so a session can be replayed', () => {
    const session = scaleDegreesGenerator.generate(input({ seed: 'abc', level: 3 }));
    expect(session).toMatchObject({ mode: 'scaleDegrees', level: 3, seed: 'abc' });
  });

  it('generates exactly the count asked for', () => {
    for (const count of [1, 15, 20, 50]) {
      expect(scaleDegreesGenerator.generate(input({ count })).questions).toHaveLength(count);
    }
  });

  it('generates nothing for a count of zero', () => {
    expect(scaleDegreesGenerator.generate(input({ count: 0 })).questions).toEqual([]);
  });

  it('fills in every field of the contract', () => {
    for (const question of scaleDegreesGenerator.generate(input({ count: 10 })).questions) {
      expect(question.id).toBeTruthy();
      expect(question.mode).toBe('scaleDegrees');
      expect(question.promptText).toBe('Which scale degree is that?');
      expect(question.audio.length).toBeGreaterThan(0);
      expect(question.reference.length).toBeGreaterThan(0);
      expect(question.separator.length).toBeGreaterThan(0);
      expect(question.feedbackAudio.length).toBeGreaterThan(0);
      expect(question.choices.length).toBeGreaterThan(0);
      expect(question.correctChoiceId).toBeTruthy();
      expect(question.itemKey).toBeTruthy();
      expect(question.voicing.instrument).toBeTruthy();
      expect(Number.isInteger(question.voicing.octave)).toBe(true);
    }
  });

  it('plays the tonic before the target in feedback', () => {
    for (const question of scaleDegreesGenerator.generate(input({ count: 20 })).questions) {
      const notes = eventNotes(question.feedbackAudio);
      expect(notes).toHaveLength(2);
      expect(noteToDegree(question.voicing.key, notes[0]!)).toBe('1');
      expect(noteToDegree(question.voicing.key, notes[1]!)).toBe(question.correctChoiceId);
      expect(question.feedbackAudio[1]!.time).toBeGreaterThan(question.feedbackAudio[0]!.time);
    }
  });

  it('varies instrument, key and octave across a session', () => {
    const { questions } = scaleDegreesGenerator.generate(input({ count: 60 }));
    expect(new Set(questions.map((q) => q.voicing.instrument)).size).toBeGreaterThan(1);
    expect(new Set(questions.map((q) => q.voicing.key.tonic)).size).toBeGreaterThan(3);
  });
});
