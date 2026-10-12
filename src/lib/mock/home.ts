/**
 * Phase 1 placeholder data for the Home screen.
 *
 * This is the ONLY mock source in the app. Phase 3 replaces it with real
 * progress from the DataStore (lib/data) and Phase 6 wires the daily challenge
 * and streak to Supabase. Keep the exported shapes stable so swapping the
 * source does not touch the components.
 */

export type TrainingMode = 'scaleDegrees' | 'intervals' | 'chords' | 'progressions' | 'dictation';

export interface SkillSummary {
  mode: TrainingMode;
  /** Display name, e.g. "Scale degrees". */
  name: string;
  /** Level within the mode's ladder. */
  level: number;
  /** What this level drills, e.g. "1-3-5 + 6". */
  levelLabel: string;
  /** 0-100 progress through the current level. */
  progress: number;
  locked: boolean;
}

export interface DailyChallengeSummary {
  /** Which mode today's shared set draws from. */
  modeName: string;
  questionCount: number;
  /** Time until the UTC reset, pre-formatted for Phase 1. */
  resetsIn: string;
  completed: boolean;
}

export interface StreakSummary {
  current: number;
  best: number;
  freezesLeft: number;
}

export interface FriendChallengeSummary {
  friendName: string;
  /** Initials for the avatar placeholder. */
  friendInitials: string;
  modeName: string;
  /** The score to beat. */
  scoreToBeat: number;
}

export interface HomeData {
  displayName: string;
  initials: string;
  streak: StreakSummary;
  daily: DailyChallengeSummary;
  skills: readonly SkillSummary[];
  friendChallenge: FriendChallengeSummary;
}

export const mockHome: HomeData = {
  displayName: 'Micah',
  initials: 'MJ',
  streak: {
    current: 12,
    best: 21,
    freezesLeft: 1,
  },
  daily: {
    modeName: 'Scale degrees',
    questionCount: 10,
    resetsIn: '7h 24m',
    completed: false,
  },
  skills: [
    {
      mode: 'scaleDegrees',
      name: 'Scale degrees',
      level: 3,
      levelLabel: '1-3-5 + 6',
      progress: 68,
      locked: false,
    },
    {
      mode: 'intervals',
      name: 'Intervals',
      level: 2,
      levelLabel: 'P5, P8, M3, P4',
      progress: 41,
      locked: false,
    },
    {
      mode: 'chords',
      name: 'Chords',
      level: 1,
      levelLabel: 'Major vs minor',
      progress: 15,
      locked: false,
    },
    {
      mode: 'progressions',
      name: 'Progressions',
      level: 1,
      levelLabel: 'I-IV-V',
      progress: 0,
      locked: true,
    },
    {
      mode: 'dictation',
      name: 'Melodic dictation',
      level: 1,
      levelLabel: '3 notes, steps only',
      progress: 0,
      locked: true,
    },
  ],
  friendChallenge: {
    friendName: 'Dana',
    friendInitials: 'DR',
    modeName: 'Intervals',
    scoreToBeat: 840,
  },
};

/** Time-of-day greeting. Pure so it can be tested without mocking the clock. */
export function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
