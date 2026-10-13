/**
 * The adaptive-choices rule, straight from the spec:
 *
 * > A level starts with 2 very different options and adds one when the last 20
 * > answers are at least 85% correct and the median answer time is under 3
 * > seconds.
 *
 * Both halves matter. Accuracy alone would promote someone who gets there by
 * slow elimination; median time alone would promote someone fast and wrong.
 * Requiring both is what makes the promotion mean "this is becoming automatic".
 *
 * Median rather than mean, because one interruption mid-session shouldn't
 * undo twenty good answers.
 */

/** The level's starting choice count, before anything is earned. */
export const STARTING_CHOICES = 2;

/** How many recent answers the rule looks at. */
export const ADAPTIVE_WINDOW = 20;

export const ADAPTIVE_MIN_ACCURACY = 0.85;
export const ADAPTIVE_MAX_MEDIAN_MS = 3000;

/** The fields of an answer the rule actually reads. */
export interface AdaptiveAnswer {
  correct: boolean;
  responseMs: number;
}

export interface AdaptiveInput {
  /**
   * Answers at the current level since choices were last added, in any order
   * (only the last `ADAPTIVE_WINDOW` by position are used, so pass them
   * newest-last if order matters to you).
   */
  answers: readonly AdaptiveAnswer[];
  unlockedChoices: number;
  /** How many choices this level has in total. */
  totalChoices: number;
}

export type AdaptiveReason =
  'unlocked' | 'all-unlocked' | 'not-enough-answers' | 'accuracy-too-low' | 'too-slow';

export interface AdaptiveDecision {
  shouldUnlock: boolean;
  /** What `unlockedChoices` should become. Unchanged unless `shouldUnlock`. */
  unlockedChoices: number;
  reason: AdaptiveReason;
  /** 0-1 over the window, or `null` when the window is empty. */
  accuracy: number | null;
  medianMs: number | null;
  answersInWindow: number;
}

/** Middle value, or the mean of the two middle values. `null` when empty. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const low = sorted[middle - 1];
  const high = sorted[middle];
  if (low === undefined || high === undefined) return null;
  return (low + high) / 2;
}

export function accuracyOf(answers: readonly AdaptiveAnswer[]): number | null {
  if (answers.length === 0) return null;
  return answers.filter((answer) => answer.correct).length / answers.length;
}

/**
 * Decides whether the next answer choice has been earned.
 *
 * Pure, and deliberately returns *why* not — the drill shows nothing, but the
 * reason makes the rule debuggable and is what the tests assert on.
 */
export function evaluateAdaptive(input: AdaptiveInput): AdaptiveDecision {
  const { unlockedChoices, totalChoices } = input;
  const window = input.answers.slice(-ADAPTIVE_WINDOW);
  const accuracy = accuracyOf(window);
  const medianMs = median(window.map((answer) => answer.responseMs));

  const base = {
    unlockedChoices,
    accuracy,
    medianMs,
    answersInWindow: window.length,
  };

  if (unlockedChoices >= totalChoices) {
    return { ...base, shouldUnlock: false, reason: 'all-unlocked' };
  }
  if (window.length < ADAPTIVE_WINDOW) {
    return { ...base, shouldUnlock: false, reason: 'not-enough-answers' };
  }
  if (accuracy === null || accuracy < ADAPTIVE_MIN_ACCURACY) {
    return { ...base, shouldUnlock: false, reason: 'accuracy-too-low' };
  }
  if (medianMs === null || medianMs >= ADAPTIVE_MAX_MEDIAN_MS) {
    return { ...base, shouldUnlock: false, reason: 'too-slow' };
  }

  return {
    ...base,
    shouldUnlock: true,
    unlockedChoices: unlockedChoices + 1,
    reason: 'unlocked',
  };
}

/**
 * How close the user is to earning the next choice, 0-1. Not shown as a number
 * anywhere yet, but it is what the level progress bar is built from.
 */
export function adaptiveReadiness(input: AdaptiveInput): number {
  const window = input.answers.slice(-ADAPTIVE_WINDOW);
  if (input.unlockedChoices >= input.totalChoices) return 1;
  if (window.length === 0) return 0;

  const fill = Math.min(1, window.length / ADAPTIVE_WINDOW);
  const accuracy = accuracyOf(window) ?? 0;
  const accuracyScore = Math.min(1, accuracy / ADAPTIVE_MIN_ACCURACY);

  const medianMs = median(window.map((answer) => answer.responseMs));
  const speedScore =
    medianMs === null ? 0 : Math.min(1, ADAPTIVE_MAX_MEDIAN_MS / Math.max(1, medianMs));

  // All three have to come good, so the weakest one dominates.
  return Math.min(fill, accuracyScore, speedScore);
}
