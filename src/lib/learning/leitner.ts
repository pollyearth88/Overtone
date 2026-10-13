/**
 * Leitner spaced review, five boxes, one per item.
 *
 * > Items you miss come back sooner; mastered items come back less often (a
 * > simple Leitner box per item is enough for v1).
 *
 * Classic Leitner: a right answer promotes an item one box, a wrong answer
 * sends it all the way back to box 1. The harshness is the point — a degree you
 * just missed is exactly the one to ask again shortly.
 *
 * The intervals are shorter than a flashcard app's would be, because the unit
 * here is a 5-minute session rather than a day's study. Box 1 is deliberately
 * inside a single session: miss `b7` on question 3 and it should return before
 * the session ends, not tomorrow.
 */

import type { ItemStat, LeitnerBox } from '../data/types';
import type { ModeId } from '../modes/types';

export const LEITNER_BOX_COUNT = 5;
export const FIRST_BOX: LeitnerBox = 1;
export const LAST_BOX: LeitnerBox = 5;

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** How long an item waits after landing in each box. */
export const BOX_INTERVALS_MS: Record<LeitnerBox, number> = {
  1: 1 * MINUTE,
  2: 10 * MINUTE,
  3: 1 * DAY,
  4: 3 * DAY,
  5: 10 * DAY,
};

export function isLeitnerBox(value: number): value is LeitnerBox {
  return Number.isInteger(value) && value >= FIRST_BOX && value <= LAST_BOX;
}

/** Right answers promote by one, wrong answers reset to box 1. */
export function nextBox(box: LeitnerBox, correct: boolean): LeitnerBox {
  if (!correct) return FIRST_BOX;
  const promoted = Math.min(LAST_BOX, box + 1);
  return isLeitnerBox(promoted) ? promoted : LAST_BOX;
}

export function dueAtFor(box: LeitnerBox, from: Date): string {
  return new Date(from.getTime() + BOX_INTERVALS_MS[box]).toISOString();
}

/**
 * A freshly seen item, before it has been answered. Starts in box 1 and due
 * immediately, so an item the user has never met is always a candidate.
 */
export function newItemStat(mode: ModeId, itemKey: string, now: Date = new Date()): ItemStat {
  return {
    mode,
    itemKey,
    box: FIRST_BOX,
    dueAt: now.toISOString(),
    seen: 0,
    correct: 0,
    lastSeenAt: now.toISOString(),
  };
}

/** Applies one answer to an item's review state. */
export function reviewItem(stat: ItemStat, correct: boolean, now: Date = new Date()): ItemStat {
  const box = nextBox(stat.box, correct);
  return {
    ...stat,
    box,
    dueAt: dueAtFor(box, now),
    seen: stat.seen + 1,
    correct: stat.correct + (correct ? 1 : 0),
    lastSeenAt: now.toISOString(),
  };
}

export function isDue(stat: ItemStat, now: Date = new Date()): boolean {
  return new Date(stat.dueAt).getTime() <= now.getTime();
}

/** Due items, soonest-due first — the order a review session should ask them. */
export function dueItems(stats: readonly ItemStat[], now: Date = new Date()): ItemStat[] {
  return stats
    .filter((stat) => isDue(stat, now))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

export function dueItemKeys(stats: readonly ItemStat[], now: Date = new Date()): string[] {
  return dueItems(stats, now).map((stat) => stat.itemKey);
}

/**
 * An item counts as mastered once it has reached the last box — it has been
 * answered correctly often enough, and recently enough, to be resting.
 */
export function isMastered(stat: ItemStat): boolean {
  return stat.box >= LAST_BOX;
}

/** Per-item accuracy, or `null` for an item never answered. */
export function itemAccuracy(stat: ItemStat): number | null {
  return stat.seen === 0 ? null : stat.correct / stat.seen;
}

/**
 * Mastery across a set of items, 0-1 — the average box position, which is what
 * `skill_progress.mastery` stores. An item in box 1 contributes 0, box 5
 * contributes 1.
 */
export function masteryOf(stats: readonly ItemStat[]): number {
  if (stats.length === 0) return 0;
  const total = stats.reduce((sum, stat) => sum + (stat.box - FIRST_BOX), 0);
  return total / (stats.length * (LAST_BOX - FIRST_BOX));
}
