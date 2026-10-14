/**
 * Applying results to stored progress.
 *
 * The three rules in this folder are each pure and independently testable;
 * this is the one place that knows how they compose — what happens to a user's
 * record when they answer a question or finish a test. Keeping it here rather
 * than in the drill means the UI never owns progression logic.
 */

import type { ItemStat, SkillProgress } from '../data/types';
import type { ModeId } from '../modes/types';
import { STARTING_CHOICES, evaluateAdaptive, type AdaptiveAnswer } from './adaptive';
import { newItemStat, reviewItem } from './leitner';
import { gradeLevelTest } from './mastery';

export function newSkillProgress(mode: ModeId, now: Date = new Date()): SkillProgress {
  return {
    mode,
    level: 1,
    unlockedChoices: STARTING_CHOICES,
    highestUnlockedLevel: 1,
    masteredLevels: [],
    choicesUnlockedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export interface ApplyAnswerInput {
  progress: SkillProgress;
  /** The item's current review state, or `null` if it has never been seen. */
  stat: ItemStat | null;
  itemKey: string;
  correct: boolean;
  /**
   * Answers at this level since `progress.choicesUnlockedAt`, including the one
   * just given. The adaptive window.
   */
  answersSinceUnlock: readonly AdaptiveAnswer[];
  totalChoices: number;
  now?: Date;
}

export interface ApplyAnswerResult {
  progress: SkillProgress;
  stat: ItemStat;
  /** True when this answer earned a new choice — the drill announces it. */
  unlockedChoice: boolean;
}

/**
 * One answer's effect: the item moves box, and the level may earn a new choice.
 *
 * Unlocking resets `choicesUnlockedAt`, which empties the adaptive window — so
 * the next choice needs a fresh twenty answers rather than riding on the same
 * twenty.
 */
export function applyAnswer(input: ApplyAnswerInput): ApplyAnswerResult {
  const now = input.now ?? new Date();
  const stat = reviewItem(
    input.stat ?? newItemStat(input.progress.mode, input.itemKey, now),
    input.correct,
    now,
  );

  const decision = evaluateAdaptive({
    answers: input.answersSinceUnlock,
    unlockedChoices: input.progress.unlockedChoices,
    totalChoices: input.totalChoices,
  });

  const progress: SkillProgress = {
    ...input.progress,
    unlockedChoices: decision.unlockedChoices,
    updatedAt: now.toISOString(),
    ...(decision.shouldUnlock ? { choicesUnlockedAt: now.toISOString() } : {}),
  };

  return { progress, stat, unlockedChoice: decision.shouldUnlock };
}

export interface ApplyTestInput {
  progress: SkillProgress;
  /** The level that was tested. */
  level: number;
  answers: readonly AdaptiveAnswer[];
  /** Highest level the ladder has, so mastery cannot run past the end. */
  maxLevel: number;
  now?: Date;
}

export interface ApplyTestResult {
  progress: SkillProgress;
  passed: boolean;
  /** The level the test opened up, or `null` if nothing changed. */
  unlockedLevel: number | null;
}

/**
 * A level test's effect: passing marks the level mastered and opens the next.
 *
 * Failing changes nothing at all — no demotion, no lost choices. A bad test is
 * information, not a punishment, and the user can retake it.
 */
export function applyLevelTest(input: ApplyTestInput): ApplyTestResult {
  const now = input.now ?? new Date();
  const grade = gradeLevelTest(input.answers);

  if (!grade.passed) {
    return {
      progress: { ...input.progress, updatedAt: now.toISOString() },
      passed: false,
      unlockedLevel: null,
    };
  }

  const mastered = input.progress.masteredLevels.includes(input.level)
    ? input.progress.masteredLevels
    : [...input.progress.masteredLevels, input.level].sort((a, b) => a - b);

  const nextLevel = Math.min(input.maxLevel, input.level + 1);
  const highest = Math.max(input.progress.highestUnlockedLevel, nextLevel);
  const opened = highest > input.progress.highestUnlockedLevel ? highest : null;

  return {
    progress: {
      ...input.progress,
      masteredLevels: mastered,
      highestUnlockedLevel: highest,
      updatedAt: now.toISOString(),
    },
    passed: true,
    unlockedLevel: opened,
  };
}

/**
 * Moving to a different level.
 *
 * Choices reset to that level's **starter count**, which the mode works out —
 * it is not a flat two. A level starts with everything the previous level ended
 * with plus its first new item, so someone who has mastered level 5 arrives at
 * level 6 with the seven major degrees already in play rather than being asked
 * to tell `1` from `b2`.
 */
export function setLevel(
  progress: SkillProgress,
  level: number,
  starterChoices: number,
  now: Date = new Date(),
): SkillProgress {
  if (progress.level === level) return progress;
  return {
    ...progress,
    level,
    unlockedChoices: Math.max(STARTING_CHOICES, starterChoices),
    choicesUnlockedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function isLevelUnlocked(progress: SkillProgress, level: number): boolean {
  return level <= progress.highestUnlockedLevel;
}

export function isLevelMastered(progress: SkillProgress, level: number): boolean {
  return progress.masteredLevels.includes(level);
}
