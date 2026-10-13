import { describe, expect, it } from 'vitest';

import {
  LEVEL_TEST_PASS_RATIO,
  LEVEL_TEST_QUESTION_COUNT,
  PRACTICE_QUESTION_COUNT,
  bestCombo,
  gradeLevelTest,
  itemBreakdown,
  levelProgress,
  levelTestPassMark,
  summariseAnswers,
  weakestItems,
  type BreakdownAnswer,
} from './mastery';

function answers(n: number, correct: number, responseMs = 1500) {
  return Array.from({ length: n }, (_, index) => ({
    correct: index < correct,
    responseMs,
  }));
}

function breakdownAnswer(correctId: string, chosenId: string, responseMs = 1500): BreakdownAnswer {
  return {
    itemKey: `scaleDegrees:${correctId}`,
    correctId,
    chosenId,
    correct: correctId === chosenId,
    responseMs,
  };
}

describe('the spec constants', () => {
  it('are the numbers the spec names', () => {
    expect(LEVEL_TEST_QUESTION_COUNT).toBe(15);
    expect(LEVEL_TEST_PASS_RATIO).toBe(0.9);
    expect(PRACTICE_QUESTION_COUNT).toBe(20);
  });
});

describe('levelTestPassMark', () => {
  it('rounds up, so 15 questions need 14 — not 13.5', () => {
    expect(levelTestPassMark(15)).toBe(14);
  });

  it('defaults to the standard test length', () => {
    expect(levelTestPassMark()).toBe(14);
  });

  it('scales to other lengths', () => {
    expect(levelTestPassMark(10)).toBe(9);
    expect(levelTestPassMark(20)).toBe(18);
    expect(levelTestPassMark(1)).toBe(1);
  });
});

describe('gradeLevelTest', () => {
  it('passes at the pass mark', () => {
    const grade = gradeLevelTest(answers(15, 14));
    expect(grade.passed).toBe(true);
    expect(grade.correct).toBe(14);
    expect(grade.passMark).toBe(14);
  });

  it('fails one short of it', () => {
    const grade = gradeLevelTest(answers(15, 13));
    expect(grade.passed).toBe(false);
    expect(grade.accuracy).toBeCloseTo(13 / 15);
  });

  it('passes a perfect test', () => {
    expect(gradeLevelTest(answers(15, 15)).passed).toBe(true);
  });

  it('fails an empty test rather than passing it vacuously', () => {
    const grade = gradeLevelTest([]);
    expect(grade.passed).toBe(false);
    expect(grade.accuracy).toBe(0);
  });

  it('ignores speed — a test measures accuracy only', () => {
    expect(gradeLevelTest(answers(15, 14, 30_000)).passed).toBe(true);
  });
});

describe('bestCombo', () => {
  it('finds the longest run of correct answers', () => {
    const sequence = [true, true, false, true, true, true, false].map((correct) => ({
      correct,
      responseMs: 1000,
    }));
    expect(bestCombo(sequence)).toBe(3);
  });

  it('is the whole length when everything is right', () => {
    expect(bestCombo(answers(20, 20))).toBe(20);
  });

  it('is 0 when nothing is right', () => {
    expect(bestCombo(answers(5, 0))).toBe(0);
  });

  it('is 0 for no answers', () => {
    expect(bestCombo([])).toBe(0);
  });

  it('counts a run that ends the session', () => {
    const sequence = [false, true, true].map((correct) => ({ correct, responseMs: 1000 }));
    expect(bestCombo(sequence)).toBe(2);
  });
});

describe('summariseAnswers', () => {
  it('reports accuracy, median and best combo', () => {
    const summary = summariseAnswers(answers(20, 15, 1800));
    expect(summary.total).toBe(20);
    expect(summary.correct).toBe(15);
    expect(summary.accuracy).toBe(0.75);
    expect(summary.medianMs).toBe(1800);
    expect(summary.bestCombo).toBe(15);
  });

  it('rounds the median to a whole millisecond', () => {
    const summary = summariseAnswers([
      { correct: true, responseMs: 1000 },
      { correct: true, responseMs: 1001 },
    ]);
    expect(Number.isInteger(summary.medianMs)).toBe(true);
    expect(summary.medianMs).toBe(1001);
  });

  it('is all zeros for an empty session rather than NaN', () => {
    expect(summariseAnswers([])).toEqual({
      total: 0,
      correct: 0,
      accuracy: 0,
      medianMs: 0,
      bestCombo: 0,
    });
  });
});

describe('itemBreakdown', () => {
  it('groups by the correct answer and reports per-item accuracy', () => {
    const rows = itemBreakdown([
      breakdownAnswer('3', '3'),
      breakdownAnswer('3', '4'),
      breakdownAnswer('5', '5'),
    ]);

    const three = rows.find((row) => row.id === '3');
    expect(three?.seen).toBe(2);
    expect(three?.correct).toBe(1);
    expect(three?.accuracy).toBe(0.5);

    const five = rows.find((row) => row.id === '5');
    expect(five?.accuracy).toBe(1);
  });

  it('sorts weakest first', () => {
    const rows = itemBreakdown([
      breakdownAnswer('1', '1'),
      breakdownAnswer('b7', '6'),
      breakdownAnswer('b7', '6'),
      breakdownAnswer('3', '3'),
      breakdownAnswer('3', '4'),
    ]);
    expect(rows.map((row) => row.id)).toEqual(['b7', '3', '1']);
  });

  it('names what each item was confused with, most common first', () => {
    const rows = itemBreakdown([
      breakdownAnswer('b7', '6'),
      breakdownAnswer('b7', '6'),
      breakdownAnswer('b7', '7'),
    ]);
    expect(rows[0]?.confusedWith).toEqual([
      { id: '6', count: 2 },
      { id: '7', count: 1 },
    ]);
  });

  it('reports no confusions for an item always answered right', () => {
    const rows = itemBreakdown([breakdownAnswer('5', '5'), breakdownAnswer('5', '5')]);
    expect(rows[0]?.confusedWith).toEqual([]);
  });

  it('is stable — equal rows do not reshuffle between calls', () => {
    const input = [breakdownAnswer('3', '4'), breakdownAnswer('6', '5'), breakdownAnswer('2', '1')];
    expect(itemBreakdown(input).map((row) => row.id)).toEqual(
      itemBreakdown(input).map((row) => row.id),
    );
  });

  it('carries the itemKey through, for linking back to review state', () => {
    const rows = itemBreakdown([breakdownAnswer('b3', 'b3')]);
    expect(rows[0]?.itemKey).toBe('scaleDegrees:b3');
  });

  it('handles an empty session', () => {
    expect(itemBreakdown([])).toEqual([]);
  });
});

describe('weakestItems', () => {
  it('only lists items that were actually missed', () => {
    const rows = weakestItems([
      breakdownAnswer('1', '1'),
      breakdownAnswer('5', '5'),
      breakdownAnswer('b7', '6'),
    ]);
    expect(rows.map((row) => row.id)).toEqual(['b7']);
  });

  it('is empty for a perfect session', () => {
    expect(weakestItems([breakdownAnswer('1', '1')])).toEqual([]);
  });

  it('caps the list', () => {
    const rows = weakestItems(
      [
        breakdownAnswer('1', '2'),
        breakdownAnswer('2', '3'),
        breakdownAnswer('3', '4'),
        breakdownAnswer('4', '5'),
        breakdownAnswer('5', '6'),
      ],
      3,
    );
    expect(rows).toHaveLength(3);
  });
});

describe('levelProgress', () => {
  it('is 100 once the level is mastered', () => {
    expect(
      levelProgress({ unlockedChoices: 2, totalChoices: 7, readiness: 0, mastered: true }),
    ).toBe(100);
  });

  it('is 0 at the start of a fresh level', () => {
    expect(
      levelProgress({ unlockedChoices: 2, totalChoices: 7, readiness: 0, mastered: false }),
    ).toBe(0);
  });

  it('caps at 70 with all choices earned but the test not passed', () => {
    expect(
      levelProgress({ unlockedChoices: 7, totalChoices: 7, readiness: 1, mastered: false }),
    ).toBe(70);
  });

  it('grows as choices are earned', () => {
    const third = levelProgress({
      unlockedChoices: 3,
      totalChoices: 7,
      readiness: 0,
      mastered: false,
    });
    const fifth = levelProgress({
      unlockedChoices: 5,
      totalChoices: 7,
      readiness: 0,
      mastered: false,
    });
    expect(fifth).toBeGreaterThan(third);
  });

  it('fills the gap between notches with readiness', () => {
    const cold = levelProgress({
      unlockedChoices: 3,
      totalChoices: 7,
      readiness: 0,
      mastered: false,
    });
    const warm = levelProgress({
      unlockedChoices: 3,
      totalChoices: 7,
      readiness: 0.9,
      mastered: false,
    });
    expect(warm).toBeGreaterThan(cold);
    // But never past the next notch.
    const nextNotch = levelProgress({
      unlockedChoices: 4,
      totalChoices: 7,
      readiness: 0,
      mastered: false,
    });
    expect(warm).toBeLessThanOrEqual(nextNotch + 1);
  });

  it('handles a two-choice level, where there is nothing to earn', () => {
    expect(
      levelProgress({ unlockedChoices: 2, totalChoices: 2, readiness: 0, mastered: false }),
    ).toBe(70);
  });

  it('always lands in 0-100 and returns a whole number', () => {
    for (const unlocked of [2, 3, 5, 7, 12]) {
      for (const total of [2, 4, 7, 12]) {
        for (const readiness of [0, 0.5, 1, 2, -1]) {
          const value = levelProgress({
            unlockedChoices: unlocked,
            totalChoices: total,
            readiness,
            mastered: false,
          });
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(100);
          expect(Number.isInteger(value)).toBe(true);
        }
      }
    }
  });
});
