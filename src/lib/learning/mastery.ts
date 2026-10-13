/**
 * Level tests, session scoring and the progress number on the Home screen.
 *
 * > Practice shows feedback; a level test (about 15 questions, no feedback)
 * > unlocks the next level at 90% or better.
 */

import { STARTING_CHOICES, median, type AdaptiveAnswer } from './adaptive';

export const LEVEL_TEST_QUESTION_COUNT = 15;
export const LEVEL_TEST_PASS_RATIO = 0.9;

/** The practice session length from the spec: 20 questions, about 5 minutes. */
export const PRACTICE_QUESTION_COUNT = 20;

/** How many correct answers a test of `total` questions needs. */
export function levelTestPassMark(total: number = LEVEL_TEST_QUESTION_COUNT): number {
  return Math.ceil(total * LEVEL_TEST_PASS_RATIO);
}

export interface TestGrade {
  correct: number;
  total: number;
  /** 0-1. */
  accuracy: number;
  passMark: number;
  passed: boolean;
}

export function gradeLevelTest(answers: readonly AdaptiveAnswer[]): TestGrade {
  const total = answers.length;
  const correct = answers.filter((answer) => answer.correct).length;
  const passMark = levelTestPassMark(total);
  return {
    correct,
    total,
    accuracy: total === 0 ? 0 : correct / total,
    passMark,
    passed: total > 0 && correct >= passMark,
  };
}

/** The longest run of correct answers, in order. */
export function bestCombo(answers: readonly AdaptiveAnswer[]): number {
  let best = 0;
  let run = 0;
  for (const answer of answers) {
    run = answer.correct ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

export interface SessionSummary {
  total: number;
  correct: number;
  /** 0-1. */
  accuracy: number;
  medianMs: number;
  bestCombo: number;
}

export function summariseAnswers(answers: readonly AdaptiveAnswer[]): SessionSummary {
  const total = answers.length;
  const correct = answers.filter((answer) => answer.correct).length;
  return {
    total,
    correct,
    accuracy: total === 0 ? 0 : correct / total,
    medianMs: Math.round(median(answers.map((answer) => answer.responseMs)) ?? 0),
    bestCombo: bestCombo(answers),
  };
}

/**
 * The fields a breakdown needs. Narrow on purpose: both a stored
 * `AnswerRecord` and the drill's in-memory answer satisfy it structurally, so
 * the summary screen can work from either without inventing fields.
 */
export interface BreakdownAnswer extends AdaptiveAnswer {
  itemKey: string;
  chosenId: string;
  correctId: string;
}

export interface ItemBreakdown {
  itemKey: string;
  /** The answer id, e.g. the degree `b7`. */
  id: string;
  seen: number;
  correct: number;
  /** 0-1. */
  accuracy: number;
  medianMs: number;
  /**
   * What they picked instead, most common first. This is the genuinely useful
   * part of a summary: "b7 → you said 6" tells you what to practise.
   */
  confusedWith: { id: string; count: number }[];
}

/**
 * Per-item results for one session, weakest first.
 *
 * Ties break on volume then alphabetically, so the order is stable — a summary
 * screen that reshuffles on re-render is worse than useless.
 */
export function itemBreakdown(answers: readonly BreakdownAnswer[]): ItemBreakdown[] {
  const groups = new Map<string, BreakdownAnswer[]>();
  for (const answer of answers) {
    const list = groups.get(answer.correctId) ?? [];
    list.push(answer);
    groups.set(answer.correctId, list);
  }

  const out: ItemBreakdown[] = [];
  for (const [id, group] of groups) {
    const correct = group.filter((answer) => answer.correct).length;

    const wrongCounts = new Map<string, number>();
    for (const answer of group) {
      if (answer.correct) continue;
      wrongCounts.set(answer.chosenId, (wrongCounts.get(answer.chosenId) ?? 0) + 1);
    }

    out.push({
      itemKey: group[0]?.itemKey ?? id,
      id,
      seen: group.length,
      correct,
      accuracy: correct / group.length,
      medianMs: Math.round(median(group.map((answer) => answer.responseMs)) ?? 0),
      confusedWith: [...wrongCounts.entries()]
        .map(([chosenId, count]) => ({ id: chosenId, count }))
        .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
    });
  }

  return out.sort((a, b) => a.accuracy - b.accuracy || b.seen - a.seen || a.id.localeCompare(b.id));
}

/** The items worth naming on a summary screen: anything missed at least once. */
export function weakestItems(answers: readonly BreakdownAnswer[], limit = 3): ItemBreakdown[] {
  return itemBreakdown(answers)
    .filter((item) => item.accuracy < 1)
    .slice(0, limit);
}

export interface LevelProgressInput {
  unlockedChoices: number;
  totalChoices: number;
  /** Readiness for the next choice, 0-1, from `adaptiveReadiness`. */
  readiness: number;
  /** Whether this level's test has been passed. */
  mastered: boolean;
}

/**
 * The 0-100 number behind the Home screen's progress bar.
 *
 * A level has two halves: earn all the answer choices, then pass the test. So
 * unlocking choices fills the bar to 70%, readiness for the next choice fills
 * the gap between notches, and the last 30% is the test.
 */
export function levelProgress(input: LevelProgressInput): number {
  const { unlockedChoices, totalChoices, readiness, mastered } = input;
  if (mastered) return 100;

  const earnable = Math.max(1, totalChoices - STARTING_CHOICES);
  const earned = Math.max(0, unlockedChoices - STARTING_CHOICES);

  if (unlockedChoices >= totalChoices) {
    // All choices earned: the remaining 30% is the level test, which the user
    // has not passed (we would have returned 100 above).
    return 70;
  }

  const notch = (earned / earnable) * 70;
  const partial = (Math.max(0, Math.min(1, readiness)) / earnable) * 70;
  return Math.max(0, Math.min(100, Math.round(notch + partial)));
}
