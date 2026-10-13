/**
 * The stored records — the third of the three interfaces the spec keeps
 * swappable.
 *
 * These shapes deliberately mirror the spec's Postgres tables (`skill_progress`,
 * `sessions`, `answers`, `item_stats`) one field at a time, so that Phase 4's
 * `SupabaseStore` is a transport change rather than a data-model change. Dates
 * are ISO strings for the same reason: that is what crosses the wire, and it
 * survives IndexedDB and JSON without a custom serialiser.
 */

import type { InstrumentId } from '../audio/instruments';
import type { ModeId, SessionKind } from '../modes/types';

/** Leitner box, 1 (soonest) to 5 (furthest out). */
export type LeitnerBox = 1 | 2 | 3 | 4 | 5;

/**
 * One answered question. The spec requires every answer to record its item,
 * correctness, response time, instrument and octave; `chosenId` is here on top
 * of that because "which wrong answer did they give" is what powers the
 * weakest-items analysis ("b7 heard as 6").
 */
export interface AnswerRecord {
  id: string;
  sessionId: string;
  mode: ModeId;
  level: number;
  itemKey: string;
  /** The choice the user made. Equal to `correctId` when they were right. */
  chosenId: string;
  correctId: string;
  correct: boolean;
  responseMs: number;
  instrument: InstrumentId;
  /** Octave of the tonic the question was voiced in. */
  octave: number;
  /** `keyId()` of the key, e.g. `Eb-major`. */
  keyId: string;
  answeredAt: string;
}

/** One practice run, test, game or listen session. */
export interface SessionRecord {
  id: string;
  mode: ModeId;
  level: number;
  kind: SessionKind;
  /** Stored so the exact question set can be replayed. */
  seed: string;
  questionCount: number;
  startedAt: string;
  /** Unset while the session is still open. */
  endedAt?: string;
  correctCount?: number;
  /** 0-1. */
  accuracy?: number;
  medianMs?: number;
  bestCombo?: number;
  /** Level tests only: whether it cleared the pass mark. */
  passed?: boolean;
}

/** Spaced-review state for one item, keyed by `mode` + `itemKey`. */
export interface ItemStat {
  mode: ModeId;
  itemKey: string;
  box: LeitnerBox;
  /** When this item becomes eligible to come back. */
  dueAt: string;
  seen: number;
  correct: number;
  lastSeenAt: string;
}

/** Where the user is in one mode's ladder. */
export interface SkillProgress {
  mode: ModeId;
  /** The level currently being practised. */
  level: number;
  /**
   * How many of the current level's answer choices are available. The spec's
   * adaptive rule: a level starts with 2 and earns the rest.
   */
  unlockedChoices: number;
  /** Highest level the user may open. Raised by passing a level test. */
  highestUnlockedLevel: number;
  /** Levels whose test has been passed. */
  masteredLevels: number[];
  /**
   * When choices were last added. The adaptive window only counts answers after
   * this, so unlocking a choice doesn't immediately unlock the next one off the
   * back of the same twenty answers.
   */
  choicesUnlockedAt: string;
  updatedAt: string;
}

/** What `recordAnswer` needs; the store assigns `id` and `answeredAt`. */
export type NewAnswer = Omit<AnswerRecord, 'id' | 'answeredAt'>;

/** What `startSession` needs; the store assigns `id` and `startedAt`. */
export type NewSession = Omit<
  SessionRecord,
  'id' | 'startedAt' | 'endedAt' | 'correctCount' | 'accuracy' | 'medianMs' | 'bestCombo' | 'passed'
>;

/** The closing figures for a session. */
export interface SessionOutcome {
  correctCount: number;
  accuracy: number;
  medianMs: number;
  bestCombo: number;
  passed?: boolean;
}

export interface RecentAnswersQuery {
  mode: ModeId;
  level?: number;
  /** Only answers at or after this ISO timestamp. */
  since?: string;
  /** Newest N. */
  limit?: number;
}

/**
 * Persistence. `LocalStore` implements it now; `SupabaseStore` will implement it
 * in Phase 4 and the app will not notice.
 */
export interface DataStore {
  getSkillProgress(mode: ModeId): Promise<SkillProgress | null>;
  getAllSkillProgress(): Promise<SkillProgress[]>;
  saveSkillProgress(progress: SkillProgress): Promise<void>;

  startSession(session: NewSession): Promise<SessionRecord>;
  finishSession(sessionId: string, outcome: SessionOutcome): Promise<void>;
  getSession(sessionId: string): Promise<SessionRecord | null>;
  listSessions(mode?: ModeId, limit?: number): Promise<SessionRecord[]>;

  recordAnswer(answer: NewAnswer): Promise<AnswerRecord>;
  getSessionAnswers(sessionId: string): Promise<AnswerRecord[]>;
  /** Newest first. The adaptive rule's input. */
  getRecentAnswers(query: RecentAnswersQuery): Promise<AnswerRecord[]>;

  getItemStats(mode: ModeId): Promise<ItemStat[]>;
  saveItemStat(stat: ItemStat): Promise<void>;
  getDueItemKeys(mode: ModeId, now?: Date): Promise<string[]>;

  /** Wipes everything. Settings → delete my data, and test teardown. */
  clear(): Promise<void>;
}
