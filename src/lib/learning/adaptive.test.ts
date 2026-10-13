import { describe, expect, it } from 'vitest';

import {
  ADAPTIVE_MAX_MEDIAN_MS,
  ADAPTIVE_MIN_ACCURACY,
  ADAPTIVE_WINDOW,
  STARTING_CHOICES,
  accuracyOf,
  adaptiveReadiness,
  evaluateAdaptive,
  median,
  type AdaptiveAnswer,
} from './adaptive';

/** `n` answers, `correct` of them right, all at `responseMs`. */
function answers(n: number, correct: number, responseMs = 1500): AdaptiveAnswer[] {
  return Array.from({ length: n }, (_, index) => ({
    correct: index < correct,
    responseMs,
  }));
}

describe('the spec constants', () => {
  it('are the numbers the spec names', () => {
    expect(STARTING_CHOICES).toBe(2);
    expect(ADAPTIVE_WINDOW).toBe(20);
    expect(ADAPTIVE_MIN_ACCURACY).toBe(0.85);
    expect(ADAPTIVE_MAX_MEDIAN_MS).toBe(3000);
  });
});

describe('median', () => {
  it('takes the middle value of an odd-length list', () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it('averages the two middle values of an even-length list', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it('is null for an empty list', () => {
    expect(median([])).toBeNull();
  });

  it('does not mutate its input', () => {
    const values = [3, 1, 2];
    median(values);
    expect(values).toEqual([3, 1, 2]);
  });

  it('ignores one wild outlier, which is why it is not a mean', () => {
    // A single interruption mid-session must not undo twenty good answers.
    const normal = Array.from({ length: 19 }, () => 1200);
    expect(median([...normal, 90_000])).toBe(1200);
  });
});

describe('accuracyOf', () => {
  it('is the fraction correct', () => {
    expect(accuracyOf(answers(20, 17))).toBeCloseTo(0.85);
    expect(accuracyOf(answers(4, 1))).toBe(0.25);
  });

  it('is null with nothing to measure', () => {
    expect(accuracyOf([])).toBeNull();
  });
});

describe('evaluateAdaptive: it needs all three conditions', () => {
  it('unlocks on exactly 20 answers at exactly 85% and comfortably fast', () => {
    const decision = evaluateAdaptive({
      answers: answers(20, 17, 1500),
      unlockedChoices: 2,
      totalChoices: 7,
    });
    expect(decision.shouldUnlock).toBe(true);
    expect(decision.unlockedChoices).toBe(3);
    expect(decision.reason).toBe('unlocked');
  });

  it('refuses with fewer than 20 answers, however good they are', () => {
    const decision = evaluateAdaptive({
      answers: answers(19, 19, 800),
      unlockedChoices: 2,
      totalChoices: 7,
    });
    expect(decision.shouldUnlock).toBe(false);
    expect(decision.reason).toBe('not-enough-answers');
    expect(decision.unlockedChoices).toBe(2);
  });

  it('refuses just under 85%', () => {
    // 16/20 is 80%.
    const decision = evaluateAdaptive({
      answers: answers(20, 16, 1000),
      unlockedChoices: 2,
      totalChoices: 7,
    });
    expect(decision.shouldUnlock).toBe(false);
    expect(decision.reason).toBe('accuracy-too-low');
  });

  it('refuses when the median is 3 seconds or slower', () => {
    const decision = evaluateAdaptive({
      answers: answers(20, 20, 3000),
      unlockedChoices: 2,
      totalChoices: 7,
    });
    expect(decision.shouldUnlock).toBe(false);
    expect(decision.reason).toBe('too-slow');
  });

  it('allows a median just under 3 seconds', () => {
    const decision = evaluateAdaptive({
      answers: answers(20, 20, 2999),
      unlockedChoices: 2,
      totalChoices: 7,
    });
    expect(decision.shouldUnlock).toBe(true);
  });

  it('checks accuracy before speed, so the reason is the more important one', () => {
    const decision = evaluateAdaptive({
      answers: answers(20, 10, 9000),
      unlockedChoices: 2,
      totalChoices: 7,
    });
    expect(decision.reason).toBe('accuracy-too-low');
  });
});

describe('evaluateAdaptive: the window', () => {
  it('only looks at the last 20 answers', () => {
    // A terrible start followed by twenty good answers still unlocks.
    const bad = answers(30, 0, 8000);
    const good = answers(20, 20, 900);
    const decision = evaluateAdaptive({
      answers: [...bad, ...good],
      unlockedChoices: 2,
      totalChoices: 7,
    });
    expect(decision.answersInWindow).toBe(20);
    expect(decision.shouldUnlock).toBe(true);
  });

  it('is dragged down by recent misses even after a good run', () => {
    const good = answers(20, 20, 900);
    const bad = answers(10, 0, 900);
    const decision = evaluateAdaptive({
      answers: [...good, ...bad],
      unlockedChoices: 2,
      totalChoices: 7,
    });
    // Window is the last 20: ten right then ten wrong.
    expect(decision.accuracy).toBeCloseTo(0.5);
    expect(decision.shouldUnlock).toBe(false);
  });

  it('reports the measurements even when it refuses', () => {
    const decision = evaluateAdaptive({
      answers: answers(20, 10, 5000),
      unlockedChoices: 2,
      totalChoices: 7,
    });
    expect(decision.accuracy).toBeCloseTo(0.5);
    expect(decision.medianMs).toBe(5000);
  });
});

describe('evaluateAdaptive: the ceiling', () => {
  it('stops once every choice is unlocked', () => {
    const decision = evaluateAdaptive({
      answers: answers(20, 20, 500),
      unlockedChoices: 7,
      totalChoices: 7,
    });
    expect(decision.shouldUnlock).toBe(false);
    expect(decision.reason).toBe('all-unlocked');
    expect(decision.unlockedChoices).toBe(7);
  });

  it('never overshoots the total', () => {
    let unlocked = STARTING_CHOICES;
    for (let i = 0; i < 50; i += 1) {
      const decision = evaluateAdaptive({
        answers: answers(20, 20, 500),
        unlockedChoices: unlocked,
        totalChoices: 4,
      });
      unlocked = decision.unlockedChoices;
    }
    expect(unlocked).toBe(4);
  });

  it('adds exactly one choice at a time', () => {
    const decision = evaluateAdaptive({
      answers: answers(100, 100, 400),
      unlockedChoices: 2,
      totalChoices: 12,
    });
    expect(decision.unlockedChoices).toBe(3);
  });
});

describe('evaluateAdaptive: edge cases', () => {
  it('handles an empty answer list', () => {
    const decision = evaluateAdaptive({ answers: [], unlockedChoices: 2, totalChoices: 7 });
    expect(decision.shouldUnlock).toBe(false);
    expect(decision.reason).toBe('not-enough-answers');
    expect(decision.accuracy).toBeNull();
    expect(decision.medianMs).toBeNull();
  });

  it('handles a level with only two choices — nothing to earn', () => {
    const decision = evaluateAdaptive({
      answers: answers(20, 20, 500),
      unlockedChoices: 2,
      totalChoices: 2,
    });
    expect(decision.reason).toBe('all-unlocked');
  });

  it('is pure', () => {
    const input = {
      answers: answers(20, 17, 1500),
      unlockedChoices: 2,
      totalChoices: 7,
    };
    const first = evaluateAdaptive(input);
    const second = evaluateAdaptive(input);
    expect(first).toEqual(second);
    expect(input.answers).toHaveLength(20);
  });
});

describe('adaptiveReadiness', () => {
  it('is 0 with no answers', () => {
    expect(adaptiveReadiness({ answers: [], unlockedChoices: 2, totalChoices: 7 })).toBe(0);
  });

  it('is 1 when everything is already unlocked', () => {
    expect(adaptiveReadiness({ answers: [], unlockedChoices: 7, totalChoices: 7 })).toBe(1);
  });

  it('reaches 1 exactly when the rule would unlock', () => {
    const ready = adaptiveReadiness({
      answers: answers(20, 20, 1000),
      unlockedChoices: 2,
      totalChoices: 7,
    });
    expect(ready).toBe(1);
  });

  it('is held back by whichever condition is worst', () => {
    // Full window, perfect accuracy, but far too slow.
    const slow = adaptiveReadiness({
      answers: answers(20, 20, 12_000),
      unlockedChoices: 2,
      totalChoices: 7,
    });
    expect(slow).toBeGreaterThan(0);
    expect(slow).toBeLessThan(0.3);
  });

  it('grows as the window fills', () => {
    const five = adaptiveReadiness({
      answers: answers(5, 5, 1000),
      unlockedChoices: 2,
      totalChoices: 7,
    });
    const fifteen = adaptiveReadiness({
      answers: answers(15, 15, 1000),
      unlockedChoices: 2,
      totalChoices: 7,
    });
    expect(fifteen).toBeGreaterThan(five);
  });

  it('always lands in 0-1', () => {
    for (const n of [0, 1, 7, 20, 60]) {
      for (const ms of [200, 1500, 3000, 30_000]) {
        const value = adaptiveReadiness({
          answers: answers(n, Math.floor(n / 2), ms),
          unlockedChoices: 2,
          totalChoices: 7,
        });
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
    }
  });
});
