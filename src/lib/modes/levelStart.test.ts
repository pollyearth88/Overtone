/**
 * How a level starts.
 *
 * A level begins with everything the one below it ended with — mastered degrees
 * carry forward — plus its first new item. The bug these tests exist to prevent
 * is the one this replaced: level 6 used to reset to two options and open by
 * asking the user to tell `1` from `b2`, a semitone apart.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CADENCE_GAP_SECONDS,
  MAX_SCALE_DEGREE_LEVEL,
  SCALE_DEGREE_LEVELS,
  UNIVERSAL_STARTER,
  buildChoices,
  carriesForwardInto,
  levelDegrees,
  levelSpec,
  levelStarterCount,
  levelUnlockOrder,
  questionSequence,
  scaleDegreesGenerator,
  unlockedChoiceIds,
  unlockedDegrees,
} from './scaleDegrees';
import type { GeneratorInput, GeneratorSettings } from './types';
import { sequenceDuration } from '../audio/events';
import { INSTRUMENT_IDS } from '../audio/instruments';
import {
  DEGREE_SEMITONES,
  MAJOR_DEGREES,
  NATURAL_MINOR_DEGREES,
  degreeToNote,
  type Degree,
} from '../theory/degrees';
import { midiOf } from '../theory/notes';

const ALL_LEVELS = SCALE_DEGREE_LEVELS.map((spec) => spec.level);

const settings = (overrides: Partial<GeneratorSettings> = {}): GeneratorSettings => ({
  instruments: [...INSTRUMENT_IDS],
  ...overrides,
});

const input = (overrides: Partial<GeneratorInput> = {}): GeneratorInput => ({
  seed: 'level-start',
  level: 4,
  count: 20,
  settings: settings(),
  ...overrides,
});

/** The degrees a level opens with, for a given entry path. */
function starterDegrees(level: number, carriedForward: boolean): Degree[] {
  return unlockedDegrees(level, levelStarterCount(level, carriedForward), carriedForward);
}

describe('no level starts with an indiscriminable pair', () => {
  it('never opens with only two options a half step apart', () => {
    for (const level of ALL_LEVELS) {
      for (const carriedForward of [true, false]) {
        const starter = starterDegrees(level, carriedForward);
        expect(starter.length, `level ${level}`).toBeGreaterThanOrEqual(2);

        if (starter.length === 2) {
          const first = starter[0];
          const second = starter[1];
          const gap = Math.abs(DEGREE_SEMITONES[first!] - DEGREE_SEMITONES[second!]);
          expect(
            gap,
            `level ${level} carried=${carriedForward} opens with ${starter.join(' vs ')}`,
          ).toBeGreaterThan(1);
        }
      }
    }
  });

  it('always spans at least a fifth across the opening set', () => {
    for (const level of ALL_LEVELS) {
      for (const carriedForward of [true, false]) {
        const semitones = starterDegrees(level, carriedForward).map(
          (degree) => DEGREE_SEMITONES[degree],
        );
        const widest = Math.max(...semitones) - Math.min(...semitones);
        expect(widest, `level ${level} carried=${carriedForward}`).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('includes 1 and 5 at every level, so the fallback pair always exists', () => {
    for (const level of ALL_LEVELS) {
      for (const degree of UNIVERSAL_STARTER) {
        expect(levelDegrees(level), `level ${level}`).toContain(degree);
      }
    }
  });
});

describe('carrying forward', () => {
  it('unlocks every carried degree from the first question', () => {
    for (let level = 2; level <= MAX_SCALE_DEGREE_LEVEL; level += 1) {
      const starter = starterDegrees(level, true);
      for (const degree of levelSpec(level).carried) {
        expect(starter, `level ${level} should carry ${degree}`).toContain(degree);
      }
    }
  });

  it('carries the previous level entirely, plus one new item', () => {
    for (let level = 2; level <= MAX_SCALE_DEGREE_LEVEL; level += 1) {
      const spec = levelSpec(level);
      const starter = starterDegrees(level, true);
      const expected = Math.min(
        levelDegrees(level).length,
        spec.carried.length + (spec.introduces.length > 0 ? 1 : 0),
      );
      expect(starter, `level ${level}`).toHaveLength(Math.max(2, expected));
    }
  });

  it('carries the major degrees into level 6 and adds b7, not b2', () => {
    const starter = starterDegrees(6, true);
    expect([...starter].sort()).toEqual([...MAJOR_DEGREES, 'b7'].sort());
    expect(starter).not.toContain('b2');
  });

  it('carries the natural-minor re-voicings into level 7', () => {
    // 3, 6 and 7 mastered in major arrive as b3, b6 and b7.
    const starter = starterDegrees(7, true);
    for (const degree of NATURAL_MINOR_DEGREES) {
      expect(starter, `level 7 should carry ${degree}`).toContain(degree);
    }
  });

  it('needs the level below to have been mastered', () => {
    expect(carriesForwardInto(1, [])).toBe(true);
    expect(carriesForwardInto(6, [5])).toBe(true);
    expect(carriesForwardInto(6, [4])).toBe(false);
    expect(carriesForwardInto(6, [])).toBe(false);
  });

  it('leaves levels that introduce nothing fully unlocked', () => {
    // Levels 5 and 8 change the difficulty, not the vocabulary.
    for (const level of [5, 8]) {
      expect(starterDegrees(level, true)).toHaveLength(levelDegrees(level).length);
    }
  });
});

describe('unlock order', () => {
  it('adds chromatic degrees easiest-first: b7, b3, b6, #4, b2', () => {
    expect(levelUnlockOrder(6, true).slice(7)).toEqual(['b7', 'b3', 'b6', '#4', 'b2']);
  });

  it('adds the raised 7th before the raised 6th at level 7', () => {
    expect(levelSpec(7).introduces).toEqual(['7', '6']);
    expect(levelUnlockOrder(7, true).slice(7)).toEqual(['7', '6']);
  });

  it('gives level 7 nine degrees, not all twelve', () => {
    expect(levelDegrees(7)).toHaveLength(9);
    expect(levelDegrees(7)).not.toContain('b2');
    expect(levelDegrees(7)).not.toContain('#4');
  });

  it('builds each level from exactly its carried plus introduced degrees', () => {
    for (const level of ALL_LEVELS) {
      const spec = levelSpec(level);
      const combined = [...spec.carried, ...spec.introduces];
      expect(new Set(combined).size, `level ${level} has a duplicate`).toBe(combined.length);
      expect([...levelDegrees(level)].sort()).toEqual([...combined].sort());
    }
  });

  it('never unlocks below the starter count, however it is asked', () => {
    for (const level of ALL_LEVELS) {
      const floor = levelStarterCount(level, true);
      expect(unlockedDegrees(level, 0, true)).toHaveLength(floor);
      expect(unlockedDegrees(level, -5, true)).toHaveLength(floor);
    }
  });
});

describe('opening a level cold', () => {
  it('starts with 1, 5 and the level’s first new degree', () => {
    for (const level of ALL_LEVELS) {
      const starter = starterDegrees(level, false);
      expect(starter, `level ${level}`).toContain('1');
      expect(starter, `level ${level}`).toContain('5');

      const firstNew = levelSpec(level).introduces[0];
      if (firstNew) expect(starter, `level ${level}`).toContain(firstNew);

      expect(starter.length, `level ${level}`).toBeLessThanOrEqual(3);
    }
  });

  it('carries nothing forward', () => {
    const cold = starterDegrees(6, false);
    expect([...cold].sort()).toEqual(['1', '5', 'b7'].sort());
    expect(cold).not.toContain('3');
  });

  it('asks only those degrees', () => {
    const { questions } = scaleDegreesGenerator.generate(
      input({
        level: 6,
        count: 40,
        settings: settings({
          unlockedChoiceIds: unlockedChoiceIds(6, levelStarterCount(6, false), false),
        }),
      }),
    );
    for (const question of questions) {
      expect(['1', '5', 'b7']).toContain(question.correctChoiceId);
    }
  });

  it('still shows the whole level on the grid, with the rest dimmed', () => {
    const choices = buildChoices(6, unlockedChoiceIds(6, levelStarterCount(6, false), false));
    expect(choices).toHaveLength(12);
    expect(choices.filter((choice) => !choice.locked)).toHaveLength(3);
  });
});

describe('the cadence gap', () => {
  it('defaults to the value tuned by ear', () => {
    expect(DEFAULT_CADENCE_GAP_SECONDS).toBeCloseTo(0.55);
  });

  it('places the target that far after the cadence ends', () => {
    const [question] = scaleDegreesGenerator.generate(input({ count: 1 })).questions;
    const referenceEnd = sequenceDuration(question!.reference);

    for (const gap of [0, 0.3, 0.55, 1.2]) {
      const sequence = questionSequence(question!, gap);
      expect(sequence[sequence.length - 1]?.time).toBeCloseTo(referenceEnd + gap, 5);
    }
  });

  it('never goes negative', () => {
    const [question] = scaleDegreesGenerator.generate(input({ count: 1 })).questions;
    const sequence = questionSequence(question!, -3);
    expect(sequence[sequence.length - 1]?.time).toBeCloseTo(
      sequenceDuration(question!.reference),
      5,
    );
  });

  it('lives in one place only — the cadence carries no trailing silence', () => {
    // Split across two places, the setting would lie about its own value.
    const [question] = scaleDegreesGenerator.generate(input({ count: 1 })).questions;
    expect(question!.reference.filter((event) => event.kind === 'rest')).toHaveLength(0);
  });
});

describe('minor levels', () => {
  it('set the key with a major V, so the raised 7th is already in the ear', () => {
    // Which is the argument for introducing natural 7 before natural 6.
    const { questions } = scaleDegreesGenerator.generate(input({ level: 7, count: 10 }));
    for (const question of questions) {
      const chords = question.reference.filter((event) => event.kind === 'chord');
      expect(chords).toHaveLength(4);

      const dominant = chords[2]!;
      const raisedSeventh = degreeToNote(question.voicing.key, '7', question.voicing.octave);
      const chromas = dominant.notes.map((note) => midiOf(note) % 12);
      expect(chromas).toContain(midiOf(raisedSeventh) % 12);
    }
  });
});
