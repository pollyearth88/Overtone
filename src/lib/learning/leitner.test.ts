import { describe, expect, it } from 'vitest';

import {
  BOX_INTERVALS_MS,
  FIRST_BOX,
  LAST_BOX,
  LEITNER_BOX_COUNT,
  dueAtFor,
  dueItemKeys,
  dueItems,
  isDue,
  isLeitnerBox,
  isMastered,
  itemAccuracy,
  masteryOf,
  newItemStat,
  nextBox,
  reviewItem,
} from './leitner';
import type { ItemStat, LeitnerBox } from '../data/types';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function statIn(box: LeitnerBox, dueAt = NOW.toISOString()): ItemStat {
  return {
    mode: 'scaleDegrees',
    itemKey: 'scaleDegrees:b3',
    box,
    dueAt,
    seen: 1,
    correct: 1,
    lastSeenAt: NOW.toISOString(),
  };
}

describe('the box structure', () => {
  it('has five boxes, as the spec asks', () => {
    expect(LEITNER_BOX_COUNT).toBe(5);
    expect(FIRST_BOX).toBe(1);
    expect(LAST_BOX).toBe(5);
  });

  it('has an interval for every box', () => {
    for (let box = FIRST_BOX; box <= LAST_BOX; box += 1) {
      expect(BOX_INTERVALS_MS[box as LeitnerBox]).toBeGreaterThan(0);
    }
  });

  it('spaces the boxes further apart as they go up', () => {
    for (let box = FIRST_BOX; box < LAST_BOX; box += 1) {
      expect(BOX_INTERVALS_MS[(box + 1) as LeitnerBox]).toBeGreaterThan(
        BOX_INTERVALS_MS[box as LeitnerBox],
      );
    }
  });

  it('puts box 1 inside a single session, so a miss comes back today', () => {
    // The whole point of the short first interval: miss b7 on question 3 and it
    // should return before the session ends.
    expect(BOX_INTERVALS_MS[1]).toBeLessThanOrEqual(5 * MINUTE);
  });

  it('rests a mastered item for over a week', () => {
    expect(BOX_INTERVALS_MS[5]).toBeGreaterThanOrEqual(7 * DAY);
  });

  it('narrows box numbers', () => {
    expect(isLeitnerBox(1)).toBe(true);
    expect(isLeitnerBox(5)).toBe(true);
    expect(isLeitnerBox(0)).toBe(false);
    expect(isLeitnerBox(6)).toBe(false);
    expect(isLeitnerBox(2.5)).toBe(false);
  });
});

describe('nextBox', () => {
  it('promotes one box on a correct answer', () => {
    expect(nextBox(1, true)).toBe(2);
    expect(nextBox(3, true)).toBe(4);
  });

  it('stops at the last box', () => {
    expect(nextBox(5, true)).toBe(5);
  });

  it('sends a miss all the way back to box 1, from any box', () => {
    // Classic Leitner, and deliberately harsh: a degree you just missed is
    // exactly the one to ask again shortly.
    for (const box of [1, 2, 3, 4, 5] as LeitnerBox[]) {
      expect(nextBox(box, false)).toBe(1);
    }
  });
});

describe('newItemStat', () => {
  it('starts in box 1, due immediately, unseen', () => {
    const stat = newItemStat('scaleDegrees', 'scaleDegrees:1', NOW);
    expect(stat.box).toBe(1);
    expect(stat.dueAt).toBe(NOW.toISOString());
    expect(stat.seen).toBe(0);
    expect(stat.correct).toBe(0);
  });

  it('is due right away, so an unseen item is always a candidate', () => {
    expect(isDue(newItemStat('scaleDegrees', 'scaleDegrees:1', NOW), NOW)).toBe(true);
  });
});

describe('reviewItem', () => {
  it('promotes and reschedules on a correct answer', () => {
    const stat = reviewItem(statIn(1), true, NOW);
    expect(stat.box).toBe(2);
    expect(stat.dueAt).toBe(new Date(NOW.getTime() + BOX_INTERVALS_MS[2]).toISOString());
    expect(stat.seen).toBe(2);
    expect(stat.correct).toBe(2);
  });

  it('demotes to box 1 and brings it back soon on a miss', () => {
    const stat = reviewItem(statIn(4), false, NOW);
    expect(stat.box).toBe(1);
    expect(stat.dueAt).toBe(new Date(NOW.getTime() + BOX_INTERVALS_MS[1]).toISOString());
    expect(stat.correct).toBe(1);
    expect(stat.seen).toBe(2);
  });

  it('counts seen on every answer and correct only on right ones', () => {
    let stat = newItemStat('scaleDegrees', 'scaleDegrees:5', NOW);
    stat = reviewItem(stat, true, NOW);
    stat = reviewItem(stat, false, NOW);
    stat = reviewItem(stat, true, NOW);
    expect(stat.seen).toBe(3);
    expect(stat.correct).toBe(2);
  });

  it('does not mutate the input', () => {
    const original = statIn(2);
    const copy = { ...original };
    reviewItem(original, true, NOW);
    expect(original).toEqual(copy);
  });

  it('keeps mode and itemKey', () => {
    const stat = reviewItem(statIn(1), true, NOW);
    expect(stat.mode).toBe('scaleDegrees');
    expect(stat.itemKey).toBe('scaleDegrees:b3');
  });

  it("brings a missed item back sooner than a mastered one — the spec's rule", () => {
    const missed = reviewItem(statIn(3), false, NOW);
    const mastered = reviewItem(statIn(4), true, NOW);
    expect(new Date(missed.dueAt).getTime()).toBeLessThan(new Date(mastered.dueAt).getTime());
  });

  it('climbs to the last box with a run of right answers', () => {
    let stat = newItemStat('scaleDegrees', 'scaleDegrees:3', NOW);
    for (let i = 0; i < 10; i += 1) stat = reviewItem(stat, true, NOW);
    expect(stat.box).toBe(5);
    expect(isMastered(stat)).toBe(true);
  });

  it('loses all that progress on one miss', () => {
    let stat = newItemStat('scaleDegrees', 'scaleDegrees:3', NOW);
    for (let i = 0; i < 10; i += 1) stat = reviewItem(stat, true, NOW);
    stat = reviewItem(stat, false, NOW);
    expect(stat.box).toBe(1);
    expect(isMastered(stat)).toBe(false);
  });
});

describe('dueAtFor', () => {
  it('adds the box interval to the given time', () => {
    expect(dueAtFor(3, NOW)).toBe(new Date(NOW.getTime() + BOX_INTERVALS_MS[3]).toISOString());
  });
});

describe('isDue', () => {
  it('is true once the due time has arrived', () => {
    expect(isDue(statIn(1, NOW.toISOString()), NOW)).toBe(true);
  });

  it('is true for an overdue item', () => {
    const past = new Date(NOW.getTime() - DAY).toISOString();
    expect(isDue(statIn(1, past), NOW)).toBe(true);
  });

  it('is false before the due time', () => {
    const future = new Date(NOW.getTime() + DAY).toISOString();
    expect(isDue(statIn(1, future), NOW)).toBe(false);
  });
});

describe('dueItems', () => {
  const stats: ItemStat[] = [
    { ...statIn(2, new Date(NOW.getTime() - MINUTE).toISOString()), itemKey: 'recent' },
    { ...statIn(1, new Date(NOW.getTime() - DAY).toISOString()), itemKey: 'overdue' },
    { ...statIn(5, new Date(NOW.getTime() + DAY).toISOString()), itemKey: 'resting' },
  ];

  it('returns only the due ones', () => {
    expect(dueItemKeys(stats, NOW)).toEqual(['overdue', 'recent']);
  });

  it('puts the most overdue first', () => {
    expect(dueItems(stats, NOW).map((stat) => stat.itemKey)).toEqual(['overdue', 'recent']);
  });

  it('is empty when nothing is due', () => {
    const future = [statIn(5, new Date(NOW.getTime() + DAY).toISOString())];
    expect(dueItemKeys(future, NOW)).toEqual([]);
  });

  it('handles an empty list', () => {
    expect(dueItemKeys([], NOW)).toEqual([]);
  });

  it('does not mutate the input order', () => {
    const order = stats.map((stat) => stat.itemKey);
    dueItems(stats, NOW);
    expect(stats.map((stat) => stat.itemKey)).toEqual(order);
  });
});

describe('itemAccuracy', () => {
  it('is the fraction right', () => {
    expect(itemAccuracy({ ...statIn(1), seen: 4, correct: 3 })).toBe(0.75);
  });

  it('is null for an item never answered', () => {
    expect(itemAccuracy(newItemStat('scaleDegrees', 'x', NOW))).toBeNull();
  });
});

describe('masteryOf', () => {
  it('is 0 when everything is in box 1', () => {
    expect(masteryOf([statIn(1), statIn(1)])).toBe(0);
  });

  it('is 1 when everything is in the last box', () => {
    expect(masteryOf([statIn(5), statIn(5)])).toBe(1);
  });

  it('is in between for a mixed set', () => {
    expect(masteryOf([statIn(1), statIn(5)])).toBe(0.5);
    expect(masteryOf([statIn(3)])).toBe(0.5);
  });

  it('is 0 for an empty set rather than NaN', () => {
    expect(masteryOf([])).toBe(0);
  });

  it('always lands in 0-1', () => {
    for (const box of [1, 2, 3, 4, 5] as LeitnerBox[]) {
      const value = masteryOf([statIn(box)]);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

describe('a realistic review cycle', () => {
  it('schedules a struggling item far more often than a solid one', () => {
    let struggling = newItemStat('scaleDegrees', 'scaleDegrees:b6', NOW);
    let solid = newItemStat('scaleDegrees', 'scaleDegrees:1', NOW);

    // Ten answers each: the struggling item alternates, the solid one is right.
    for (let i = 0; i < 10; i += 1) {
      struggling = reviewItem(struggling, i % 2 === 0, NOW);
      solid = reviewItem(solid, true, NOW);
    }

    expect(struggling.box).toBeLessThan(solid.box);
    expect(new Date(struggling.dueAt).getTime()).toBeLessThan(new Date(solid.dueAt).getTime());
  });
});
