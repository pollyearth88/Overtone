/**
 * The generator-contract tests.
 *
 * These assert the two properties the whole design rests on — **the same seed
 * gives the same questions**, and **every note a question plays is inside the
 * range of the instrument chosen to play it** — against the reference
 * generator. Phase 3's real generators should be held to the same two.
 */

import { describe, expect, it } from 'vitest';

import { referenceGenerator, scaleDegreeItemKey } from './reference';
import { REFERENCE_INSTRUMENT, notesFitInstrument } from './sound';
import { SEPARATOR_SILENCE_MS, type GeneratorInput, type GeneratorSettings } from './types';
import { eventNotes, sequenceDuration } from '../audio/events';
import { INSTRUMENT_IDS, getInstrument } from '../audio/instruments';
import { MAJOR_DEGREES, noteToDegree, solfege, type Degree } from '../theory/degrees';
import { midiOf } from '../theory/notes';

const settings = (overrides: Partial<GeneratorSettings> = {}): GeneratorSettings => ({
  instruments: [...INSTRUMENT_IDS],
  ...overrides,
});

const input = (overrides: Partial<GeneratorInput> = {}): GeneratorInput => ({
  seed: 'test-seed',
  level: 3,
  count: 20,
  settings: settings(),
  ...overrides,
});

describe('the generator interface', () => {
  it('declares its mode and ladder', () => {
    expect(referenceGenerator.mode).toBe('scaleDegrees');
    expect(referenceGenerator.maxLevel).toBe(3);
  });

  it('labels every level on its ladder', () => {
    for (let level = 1; level <= referenceGenerator.maxLevel; level += 1) {
      expect(referenceGenerator.levelLabel(level)).toBeTruthy();
    }
  });

  it('echoes the seed, mode and level back so a session can be replayed', () => {
    const session = referenceGenerator.generate(input({ seed: 'abc', level: 2 }));
    expect(session).toMatchObject({ mode: 'scaleDegrees', level: 2, seed: 'abc' });
  });

  it('generates exactly the number of questions asked for', () => {
    for (const count of [1, 10, 20, 50]) {
      expect(referenceGenerator.generate(input({ count })).questions).toHaveLength(count);
    }
  });

  it('generates nothing for a count of zero', () => {
    expect(referenceGenerator.generate(input({ count: 0 })).questions).toEqual([]);
  });
});

describe('the same seed gives the same questions', () => {
  it('is byte-for-byte reproducible', () => {
    const a = referenceGenerator.generate(input({ seed: 'daily-2026-10-12' }));
    const b = referenceGenerator.generate(input({ seed: 'daily-2026-10-12' }));
    expect(a).toEqual(b);
  });

  it('holds for numeric seeds too', () => {
    expect(referenceGenerator.generate(input({ seed: 99 }))).toEqual(
      referenceGenerator.generate(input({ seed: 99 })),
    );
  });

  it('gives different questions for different seeds', () => {
    const a = referenceGenerator.generate(input({ seed: 'seed-a' }));
    const b = referenceGenerator.generate(input({ seed: 'seed-b' }));
    expect(a.questions).not.toEqual(b.questions);
  });

  it('is stable question-by-question, so generating more does not change earlier ones', () => {
    // This is what `createSubRng` buys: question 5 of a 20-question set is the
    // same question 5 as in a 10-question set with the same seed.
    const short = referenceGenerator.generate(input({ count: 10 }));
    const long = referenceGenerator.generate(input({ count: 20 }));
    expect(long.questions.slice(0, 10)).toEqual(short.questions);
  });

  it('does not depend on the order generators are called in', () => {
    const first = referenceGenerator.generate(input({ seed: 'x' }));
    referenceGenerator.generate(input({ seed: 'other' }));
    referenceGenerator.generate(input({ seed: 'another' }));
    const again = referenceGenerator.generate(input({ seed: 'x' }));
    expect(again).toEqual(first);
  });

  it('never calls Math.random', () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error('a generator called Math.random');
    };
    try {
      expect(() => referenceGenerator.generate(input())).not.toThrow();
    } finally {
      Math.random = original;
    }
  });
});

describe('notes are always in range', () => {
  it('plays the question on an instrument that can actually reach it', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e', 1, 2, 3]) {
      const { questions } = referenceGenerator.generate(input({ seed, count: 30 }));
      for (const question of questions) {
        const notes = eventNotes(question.audio);
        expect(
          notesFitInstrument(notes, question.voicing.instrument),
          `${seed}: ${notes.join(',')} on ${question.voicing.instrument}`,
        ).toBe(true);
      }
    }
  });

  it('plays the cadence on an instrument that can reach all of it', () => {
    for (const seed of ['a', 'b', 'c']) {
      const { questions } = referenceGenerator.generate(input({ seed, count: 30 }));
      for (const question of questions) {
        const notes = eventNotes(question.reference);
        expect(notes.length).toBeGreaterThan(0);
        expect(notesFitInstrument(notes, REFERENCE_INSTRUMENT), `cadence ${notes.join(',')}`).toBe(
          true,
        );
      }
    }
  });

  it('keeps feedback audio in range as well', () => {
    for (const seed of ['a', 'b', 'c']) {
      const { questions } = referenceGenerator.generate(input({ seed, count: 30 }));
      for (const question of questions) {
        expect(
          notesFitInstrument(eventNotes(question.feedbackAudio), question.voicing.instrument),
        ).toBe(true);
      }
    }
  });

  it('holds at every level and for every single allowed instrument', () => {
    for (const instrument of INSTRUMENT_IDS) {
      for (let level = 1; level <= referenceGenerator.maxLevel; level += 1) {
        const { questions } = referenceGenerator.generate(
          input({ level, count: 25, settings: settings({ fixedInstrument: instrument }) }),
        );
        for (const question of questions) {
          expect(question.voicing.instrument).toBe(instrument);
          expect(
            notesFitInstrument(eventNotes(question.audio), instrument),
            `${instrument} level ${level}`,
          ).toBe(true);
        }
      }
    }
  });

  it('never strays outside the declared range even by a semitone', () => {
    const { questions } = referenceGenerator.generate(input({ count: 60 }));
    for (const question of questions) {
      const spec = getInstrument(question.voicing.instrument);
      for (const note of eventNotes(question.audio)) {
        expect(midiOf(note)).toBeGreaterThanOrEqual(midiOf(spec.range.low));
        expect(midiOf(note)).toBeLessThanOrEqual(midiOf(spec.range.high));
      }
    }
  });
});

describe('the Question shape', () => {
  const { questions } = referenceGenerator.generate(input({ count: 20 }));

  it('fills in every field of the contract', () => {
    for (const question of questions) {
      expect(question.id).toBeTruthy();
      expect(question.mode).toBe('scaleDegrees');
      expect(question.level).toBe(3);
      expect(question.promptText).toBeTruthy();
      expect(question.audio.length).toBeGreaterThan(0);
      expect(question.reference.length).toBeGreaterThan(0);
      expect(question.separator.length).toBeGreaterThan(0);
      expect(question.feedbackAudio.length).toBeGreaterThan(0);
      expect(question.choices.length).toBeGreaterThan(0);
      expect(question.correctChoiceId).toBeTruthy();
      expect(question.itemKey).toBeTruthy();
      expect(question.voicing.instrument).toBeTruthy();
      expect(question.voicing.key.tonic).toBeTruthy();
      expect(Number.isInteger(question.voicing.octave)).toBe(true);
    }
  });

  it('gives every question in a session a unique id', () => {
    const ids = questions.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('always has the correct answer among the choices, and unlocked', () => {
    for (let level = 1; level <= referenceGenerator.maxLevel; level += 1) {
      const session = referenceGenerator.generate(input({ level, count: 25 }));
      for (const question of session.questions) {
        const correct = question.choices.find((c) => c.id === question.correctChoiceId);
        expect(correct, `level ${level}: ${question.correctChoiceId}`).toBeDefined();
        expect(correct?.locked).toBeFalsy();
      }
    }
  });

  it('labels choices with the degree and its solfège', () => {
    for (const choice of questions[0]!.choices) {
      expect(choice.sublabel).toBe(solfege(choice.label as Degree));
    }
  });

  it('shows all seven degrees, dimming the ones the level has not unlocked', () => {
    const level1 = referenceGenerator.generate(input({ level: 1, count: 1 })).questions[0]!;
    expect(level1.choices.map((c) => c.id)).toEqual([...MAJOR_DEGREES]);

    const unlocked = level1.choices.filter((c) => !c.locked).map((c) => c.id);
    expect(unlocked).toEqual(['1', '5']);

    const level3 = referenceGenerator.generate(input({ level: 3, count: 1 })).questions[0]!;
    expect(level3.choices.every((c) => !c.locked)).toBe(true);
  });
});

describe('the audio a question plays', () => {
  it('plays the note the correct answer names', () => {
    const { questions } = referenceGenerator.generate(input({ count: 40 }));
    for (const question of questions) {
      const notes = eventNotes(question.audio);
      expect(notes).toHaveLength(1);
      // The sounded note really is that scale degree in that key.
      expect(noteToDegree(question.voicing.key, notes[0]!)).toBe(question.correctChoiceId);
    }
  });

  it('plays the question note on the rotating instrument, not the reference one', () => {
    const { questions } = referenceGenerator.generate(input({ count: 20 }));
    for (const question of questions) {
      for (const event of question.audio) {
        if (event.kind === 'note') expect(event.instrument).toBe(question.voicing.instrument);
      }
    }
  });

  it('plays the tonic before the target in feedback, so the gap is audible', () => {
    const { questions } = referenceGenerator.generate(input({ count: 20 }));
    for (const question of questions) {
      const notes = eventNotes(question.feedbackAudio);
      expect(notes).toHaveLength(2);
      expect(noteToDegree(question.voicing.key, notes[0]!)).toBe('1');
      expect(noteToDegree(question.voicing.key, notes[1]!)).toBe(question.correctChoiceId);
      // In that order in time, not stacked.
      expect(question.feedbackAudio[1]!.time).toBeGreaterThan(question.feedbackAudio[0]!.time);
    }
  });

  it('keeps the target note within an octave above the tonic', () => {
    const { questions } = referenceGenerator.generate(input({ count: 40 }));
    for (const question of questions) {
      const tonic = midiOf(`${question.voicing.key.tonic}${question.voicing.octave}`);
      const target = midiOf(eventNotes(question.audio)[0]!);
      expect(target).toBeGreaterThanOrEqual(tonic);
      expect(target - tonic).toBeLessThanOrEqual(12);
    }
  });

  it('separates questions with silence by default, and noise on request', () => {
    const silent = referenceGenerator.generate(input({ count: 3 }));
    for (const question of silent.questions) {
      expect(question.separator).toEqual([{ kind: 'rest', ms: SEPARATOR_SILENCE_MS, time: 0 }]);
    }

    const noisy = referenceGenerator.generate(
      input({ count: 3, settings: settings({ separator: 'noise' }) }),
    );
    for (const question of noisy.questions) {
      expect(question.separator[0]!.kind).toBe('noise');
    }
  });

  it('drops the cadence when the level turns the reference off', () => {
    const session = referenceGenerator.generate(
      input({ count: 5, settings: settings({ playReference: false }) }),
    );
    for (const question of session.questions) {
      expect(question.reference).toEqual([]);
      // The question itself still sounds.
      expect(question.audio.length).toBeGreaterThan(0);
    }
  });

  it('keeps each question short enough to stay in a five-minute session', () => {
    const { questions } = referenceGenerator.generate(input({ count: 20 }));
    const total = questions.reduce(
      (sum, question) =>
        sum +
        sequenceDuration(question.reference) +
        sequenceDuration(question.audio) +
        sequenceDuration(question.separator),
      0,
    );
    // 20 questions of audio, before the user spends any time answering.
    expect(total / questions.length).toBeLessThan(8);
  });
});

describe('itemKey', () => {
  it('names what was tested, not the particular question', () => {
    expect(scaleDegreeItemKey('b3')).toBe('scaleDegrees:b3');
  });

  it('is the same for the same degree in different keys, octaves and instruments', () => {
    const { questions } = referenceGenerator.generate(input({ count: 60 }));
    const byDegree = new Map<string, Set<string>>();

    for (const question of questions) {
      const keys = byDegree.get(question.correctChoiceId) ?? new Set<string>();
      keys.add(question.itemKey);
      byDegree.set(question.correctChoiceId, keys);
    }

    // Each degree maps to exactly one itemKey, however it was voiced.
    for (const [degree, itemKeys] of byDegree) {
      expect(itemKeys.size, degree).toBe(1);
    }
  });

  it('differs between degrees, so Leitner boxes do not collide', () => {
    const keys = MAJOR_DEGREES.map(scaleDegreeItemKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("matches the question's correct answer", () => {
    const { questions } = referenceGenerator.generate(input({ count: 30 }));
    for (const question of questions) {
      expect(question.itemKey).toBe(scaleDegreeItemKey(question.correctChoiceId as Degree));
    }
  });
});

describe('levels', () => {
  it('only asks about degrees the level has unlocked', () => {
    const expected: Record<number, Degree[]> = {
      1: ['1', '5'],
      2: ['1', '3', '5'],
      3: [...MAJOR_DEGREES],
    };
    for (const [level, degrees] of Object.entries(expected)) {
      const session = referenceGenerator.generate(input({ level: Number(level), count: 40 }));
      for (const question of session.questions) {
        expect(degrees, `level ${level}`).toContain(question.correctChoiceId);
      }
    }
  });

  it('actually uses the whole unlocked set, not just one degree', () => {
    const session = referenceGenerator.generate(input({ level: 3, count: 60 }));
    const asked = new Set(session.questions.map((q) => q.correctChoiceId));
    expect(asked.size).toBe(MAJOR_DEGREES.length);
  });

  it('clamps levels outside the ladder rather than throwing', () => {
    expect(() => referenceGenerator.generate(input({ level: 0 }))).not.toThrow();
    expect(() => referenceGenerator.generate(input({ level: 99 }))).not.toThrow();
  });
});

describe('spaced review', () => {
  it('favours due items without asking about them exclusively', () => {
    const session = referenceGenerator.generate(
      input({ count: 60, dueItemKeys: [scaleDegreeItemKey('4')] }),
    );
    const asked = session.questions.map((q) => q.correctChoiceId);
    const dueCount = asked.filter((degree) => degree === '4').length;

    // Weighted up from the 1-in-7 it would get by chance...
    expect(dueCount).toBeGreaterThan(60 / 7);
    // ...but the rest of the set still appears.
    expect(new Set(asked).size).toBeGreaterThan(1);
  });

  it('ignores due keys that are not unlocked at this level', () => {
    const session = referenceGenerator.generate(
      input({ level: 1, count: 20, dueItemKeys: [scaleDegreeItemKey('7')] }),
    );
    for (const question of session.questions) {
      expect(['1', '5']).toContain(question.correctChoiceId);
    }
  });

  it('is still reproducible with due items in play', () => {
    const due = [scaleDegreeItemKey('2'), scaleDegreeItemKey('6')];
    expect(referenceGenerator.generate(input({ dueItemKeys: due }))).toEqual(
      referenceGenerator.generate(input({ dueItemKeys: due })),
    );
  });
});
