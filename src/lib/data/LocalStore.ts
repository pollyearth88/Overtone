/**
 * `DataStore` backed by IndexedDB, for offline and signed-out use.
 *
 * Shape note: `idb-keyval` is a key/value store, not a table store, so each
 * logical table is one entry holding an array (or a record keyed by id). That
 * is fine at this scale — a heavy user accumulates a few thousand answers, and
 * the alternative is hand-rolling object stores and indexes for a dataset that
 * is about to move to Postgres anyway.
 *
 * Two consequences worth knowing:
 *
 * - **Writes are read-modify-write**, so concurrent writes to the same table
 *   could clobber each other. Every write goes through `mutate()`, which
 *   serialises them per key behind a promise chain.
 * - **Answers are capped** at `MAX_ANSWERS`, oldest dropped. Phase 4 moves the
 *   history to Postgres; until then this stops one device growing without
 *   bound. Nothing reads further back than the adaptive window anyway.
 */

import { clear as idbClear, get, set } from 'idb-keyval';

import type { ModeId } from '../modes/types';
import { dueItemKeys } from '../learning/leitner';
import type {
  AnswerRecord,
  DataStore,
  ItemStat,
  NewAnswer,
  NewSession,
  RecentAnswersQuery,
  SessionOutcome,
  SessionRecord,
  SkillProgress,
} from './types';

const KEYS = {
  skillProgress: 'overtone:skillProgress',
  sessions: 'overtone:sessions',
  answers: 'overtone:answers',
  itemStats: 'overtone:itemStats',
} as const;

/** Plenty for the adaptive window and a stats screen; see the note above. */
const MAX_ANSWERS = 5000;

function itemStatKey(mode: ModeId, itemKey: string): string {
  return `${mode}|${itemKey}`;
}

/** `crypto.randomUUID` is in every browser we target; Node 24 has it too. */
function newId(): string {
  return crypto.randomUUID();
}

export class LocalStore implements DataStore {
  /** One promise chain per key, so read-modify-write cycles cannot interleave. */
  private readonly writeChains = new Map<string, Promise<unknown>>();

  private async read<T>(key: string, fallback: T): Promise<T> {
    const value = await get<T>(key);
    return value ?? fallback;
  }

  /**
   * Serialised read-modify-write. Returns whatever the updater returns, so a
   * caller can get the record it just created without a second read.
   */
  private mutate<T, R>(key: string, fallback: T, update: (current: T) => [T, R]): Promise<R> {
    const previous = this.writeChains.get(key) ?? Promise.resolve();

    const next = previous.then(async () => {
      const current = await this.read<T>(key, fallback);
      const [updated, result] = update(current);
      await set(key, updated);
      return result;
    });

    // Keep the chain going even if this link rejects, or one failure would
    // deadlock every later write to the same key.
    this.writeChains.set(
      key,
      next.catch(() => undefined),
    );
    return next;
  }

  // --- skill progress ---

  async getSkillProgress(mode: ModeId): Promise<SkillProgress | null> {
    const all = await this.read<Record<string, SkillProgress>>(KEYS.skillProgress, {});
    return all[mode] ?? null;
  }

  async getAllSkillProgress(): Promise<SkillProgress[]> {
    const all = await this.read<Record<string, SkillProgress>>(KEYS.skillProgress, {});
    return Object.values(all);
  }

  saveSkillProgress(progress: SkillProgress): Promise<void> {
    return this.mutate<Record<string, SkillProgress>, void>(KEYS.skillProgress, {}, (current) => [
      { ...current, [progress.mode]: progress },
      undefined,
    ]);
  }

  // --- sessions ---

  startSession(session: NewSession): Promise<SessionRecord> {
    const record: SessionRecord = {
      ...session,
      id: newId(),
      startedAt: new Date().toISOString(),
    };
    return this.mutate<SessionRecord[], SessionRecord>(KEYS.sessions, [], (current) => [
      [...current, record],
      record,
    ]);
  }

  finishSession(sessionId: string, outcome: SessionOutcome): Promise<void> {
    return this.mutate<SessionRecord[], void>(KEYS.sessions, [], (current) => [
      current.map((session) =>
        session.id === sessionId
          ? { ...session, ...outcome, endedAt: new Date().toISOString() }
          : session,
      ),
      undefined,
    ]);
  }

  async getSession(sessionId: string): Promise<SessionRecord | null> {
    const sessions = await this.read<SessionRecord[]>(KEYS.sessions, []);
    return sessions.find((session) => session.id === sessionId) ?? null;
  }

  async listSessions(mode?: ModeId, limit?: number): Promise<SessionRecord[]> {
    const sessions = await this.read<SessionRecord[]>(KEYS.sessions, []);
    const filtered = mode ? sessions.filter((session) => session.mode === mode) : sessions;
    const newestFirst = [...filtered].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return limit === undefined ? newestFirst : newestFirst.slice(0, limit);
  }

  // --- answers ---

  recordAnswer(answer: NewAnswer): Promise<AnswerRecord> {
    const record: AnswerRecord = {
      ...answer,
      id: newId(),
      answeredAt: new Date().toISOString(),
    };
    return this.mutate<AnswerRecord[], AnswerRecord>(KEYS.answers, [], (current) => {
      const next = [...current, record];
      return [next.length > MAX_ANSWERS ? next.slice(next.length - MAX_ANSWERS) : next, record];
    });
  }

  async getSessionAnswers(sessionId: string): Promise<AnswerRecord[]> {
    const answers = await this.read<AnswerRecord[]>(KEYS.answers, []);
    return answers.filter((answer) => answer.sessionId === sessionId);
  }

  async getRecentAnswers(query: RecentAnswersQuery): Promise<AnswerRecord[]> {
    const answers = await this.read<AnswerRecord[]>(KEYS.answers, []);

    const matching = answers.filter((answer) => {
      if (answer.mode !== query.mode) return false;
      if (query.level !== undefined && answer.level !== query.level) return false;
      if (query.since !== undefined && answer.answeredAt < query.since) return false;
      return true;
    });

    const newestFirst = [...matching].sort((a, b) => b.answeredAt.localeCompare(a.answeredAt));
    return query.limit === undefined ? newestFirst : newestFirst.slice(0, query.limit);
  }

  // --- spaced review ---

  async getItemStats(mode: ModeId): Promise<ItemStat[]> {
    const all = await this.read<Record<string, ItemStat>>(KEYS.itemStats, {});
    return Object.values(all).filter((stat) => stat.mode === mode);
  }

  saveItemStat(stat: ItemStat): Promise<void> {
    return this.mutate<Record<string, ItemStat>, void>(KEYS.itemStats, {}, (current) => [
      { ...current, [itemStatKey(stat.mode, stat.itemKey)]: stat },
      undefined,
    ]);
  }

  async getDueItemKeys(mode: ModeId, now: Date = new Date()): Promise<string[]> {
    return dueItemKeys(await this.getItemStats(mode), now);
  }

  // --- teardown ---

  async clear(): Promise<void> {
    this.writeChains.clear();
    await idbClear();
  }
}

let shared: LocalStore | null = null;

/** The app's store. Phase 4 swaps this for a signed-in `SupabaseStore`. */
export function getDataStore(): DataStore {
  shared ??= new LocalStore();
  return shared;
}

/** Test seam. */
export function resetDataStore(): void {
  shared = null;
}
