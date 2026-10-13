/**
 * `LocalStore` against a fake `idb-keyval`.
 *
 * jsdom has no IndexedDB, and the point of these tests is the store's own logic
 * — the read-modify-write serialisation, the filtering, the answer cap — not
 * whether IndexedDB works. So the key/value layer is mocked and the store is
 * exercised through its real interface.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    // Round-trip through JSON so a test cannot accidentally rely on holding the
    // same object reference that IndexedDB would have cloned.
    store.set(key, JSON.parse(JSON.stringify(value)));
  }),
  clear: vi.fn(async () => store.clear()),
}));

const { LocalStore } = await import('./LocalStore');
import type { NewAnswer } from './types';
import { newItemStat, reviewItem } from '../learning/leitner';
import { newSkillProgress } from '../learning/progress';

function answer(overrides: Partial<NewAnswer> = {}): NewAnswer {
  return {
    sessionId: 'session-1',
    mode: 'scaleDegrees',
    level: 4,
    itemKey: 'scaleDegrees:3',
    chosenId: '3',
    correctId: '3',
    correct: true,
    responseMs: 1200,
    instrument: 'piano',
    octave: 4,
    keyId: 'C-major',
    ...overrides,
  };
}

describe('LocalStore', () => {
  let subject: InstanceType<typeof LocalStore>;

  beforeEach(() => {
    store.clear();
    subject = new LocalStore();
  });

  describe('skill progress', () => {
    it('is null before anything is saved', async () => {
      expect(await subject.getSkillProgress('scaleDegrees')).toBeNull();
    });

    it('round-trips', async () => {
      const progress = newSkillProgress('scaleDegrees');
      await subject.saveSkillProgress(progress);
      expect(await subject.getSkillProgress('scaleDegrees')).toEqual(progress);
    });

    it('overwrites rather than accumulating', async () => {
      await subject.saveSkillProgress(newSkillProgress('scaleDegrees'));
      await subject.saveSkillProgress({
        ...newSkillProgress('scaleDegrees'),
        level: 5,
      });
      const all = await subject.getAllSkillProgress();
      expect(all).toHaveLength(1);
      expect(all[0]?.level).toBe(5);
    });

    it('keeps modes separate', async () => {
      await subject.saveSkillProgress(newSkillProgress('scaleDegrees'));
      await subject.saveSkillProgress(newSkillProgress('intervals'));
      expect(await subject.getAllSkillProgress()).toHaveLength(2);
      expect((await subject.getSkillProgress('intervals'))?.mode).toBe('intervals');
    });
  });

  describe('sessions', () => {
    it('assigns an id and a start time', async () => {
      const session = await subject.startSession({
        mode: 'scaleDegrees',
        level: 1,
        kind: 'practice',
        seed: 'seed-1',
        questionCount: 20,
      });
      expect(session.id).toBeTruthy();
      expect(session.startedAt).toBeTruthy();
      expect(session.endedAt).toBeUndefined();
    });

    it('is retrievable by id', async () => {
      const session = await subject.startSession({
        mode: 'scaleDegrees',
        level: 1,
        kind: 'practice',
        seed: 'seed-1',
        questionCount: 20,
      });
      expect((await subject.getSession(session.id))?.seed).toBe('seed-1');
    });

    it('is null for an unknown id', async () => {
      expect(await subject.getSession('nope')).toBeNull();
    });

    it('records the outcome on finish', async () => {
      const session = await subject.startSession({
        mode: 'scaleDegrees',
        level: 1,
        kind: 'test',
        seed: 'seed-1',
        questionCount: 15,
      });
      await subject.finishSession(session.id, {
        correctCount: 14,
        accuracy: 14 / 15,
        medianMs: 1300,
        bestCombo: 9,
        passed: true,
      });

      const stored = await subject.getSession(session.id);
      expect(stored?.correctCount).toBe(14);
      expect(stored?.passed).toBe(true);
      expect(stored?.endedAt).toBeTruthy();
    });

    it('lists newest first and filters by mode', async () => {
      await subject.startSession({
        mode: 'scaleDegrees',
        level: 1,
        kind: 'practice',
        seed: 'a',
        questionCount: 20,
      });
      await subject.startSession({
        mode: 'intervals',
        level: 1,
        kind: 'practice',
        seed: 'b',
        questionCount: 20,
      });

      expect(await subject.listSessions()).toHaveLength(2);
      const scaleOnly = await subject.listSessions('scaleDegrees');
      expect(scaleOnly).toHaveLength(1);
      expect(scaleOnly[0]?.seed).toBe('a');
    });

    it('respects a limit', async () => {
      for (let i = 0; i < 5; i += 1) {
        await subject.startSession({
          mode: 'scaleDegrees',
          level: 1,
          kind: 'practice',
          seed: `s${i}`,
          questionCount: 20,
        });
      }
      expect(await subject.listSessions('scaleDegrees', 2)).toHaveLength(2);
    });
  });

  describe('answers', () => {
    it('assigns an id and a timestamp', async () => {
      const record = await subject.recordAnswer(answer());
      expect(record.id).toBeTruthy();
      expect(record.answeredAt).toBeTruthy();
      expect(record.itemKey).toBe('scaleDegrees:3');
    });

    it('does not lose answers written back to back', async () => {
      // The read-modify-write cycle has to serialise, or concurrent writes to
      // the same key would clobber each other.
      await Promise.all(Array.from({ length: 25 }, () => subject.recordAnswer(answer())));
      expect(await subject.getSessionAnswers('session-1')).toHaveLength(25);
    });

    it('filters by session', async () => {
      await subject.recordAnswer(answer({ sessionId: 'a' }));
      await subject.recordAnswer(answer({ sessionId: 'b' }));
      expect(await subject.getSessionAnswers('a')).toHaveLength(1);
    });

    it('filters recent answers by mode and level', async () => {
      await subject.recordAnswer(answer({ level: 4 }));
      await subject.recordAnswer(answer({ level: 5 }));
      await subject.recordAnswer(answer({ mode: 'intervals', level: 4 }));

      expect(await subject.getRecentAnswers({ mode: 'scaleDegrees' })).toHaveLength(2);
      expect(await subject.getRecentAnswers({ mode: 'scaleDegrees', level: 4 })).toHaveLength(1);
    });

    it('returns recent answers newest first', async () => {
      await subject.recordAnswer(answer({ chosenId: 'first' }));
      await new Promise((resolve) => setTimeout(resolve, 2));
      await subject.recordAnswer(answer({ chosenId: 'second' }));

      const recent = await subject.getRecentAnswers({ mode: 'scaleDegrees' });
      expect(recent[0]?.chosenId).toBe('second');
    });

    it('respects a limit — the adaptive window only wants twenty', async () => {
      for (let i = 0; i < 30; i += 1) await subject.recordAnswer(answer());
      expect(await subject.getRecentAnswers({ mode: 'scaleDegrees', limit: 20 })).toHaveLength(20);
    });

    it('filters by a since timestamp, which is how the adaptive window resets', async () => {
      await subject.recordAnswer(answer({ chosenId: 'old' }));
      await new Promise((resolve) => setTimeout(resolve, 5));
      const cutoff = new Date().toISOString();
      await new Promise((resolve) => setTimeout(resolve, 5));
      await subject.recordAnswer(answer({ chosenId: 'new' }));

      const since = await subject.getRecentAnswers({ mode: 'scaleDegrees', since: cutoff });
      expect(since).toHaveLength(1);
      expect(since[0]?.chosenId).toBe('new');
    });

    it('is empty for a mode with no answers', async () => {
      expect(await subject.getRecentAnswers({ mode: 'chords' })).toEqual([]);
    });
  });

  describe('item stats', () => {
    it('round-trips, keyed by mode and item together', async () => {
      const stat = newItemStat('scaleDegrees', 'scaleDegrees:b3');
      await subject.saveItemStat(stat);
      expect(await subject.getItemStats('scaleDegrees')).toEqual([stat]);
    });

    it('overwrites the same item rather than duplicating it', async () => {
      const first = newItemStat('scaleDegrees', 'scaleDegrees:b3');
      await subject.saveItemStat(first);
      await subject.saveItemStat(reviewItem(first, true));
      const stats = await subject.getItemStats('scaleDegrees');
      expect(stats).toHaveLength(1);
      expect(stats[0]?.box).toBe(2);
    });

    it('keeps the same itemKey in different modes apart', async () => {
      await subject.saveItemStat(newItemStat('scaleDegrees', 'shared'));
      await subject.saveItemStat(newItemStat('intervals', 'shared'));
      expect(await subject.getItemStats('scaleDegrees')).toHaveLength(1);
      expect(await subject.getItemStats('intervals')).toHaveLength(1);
    });

    it('reports which items are due', async () => {
      const now = new Date('2026-10-13T12:00:00.000Z');
      const due = newItemStat('scaleDegrees', 'due', now);
      const resting = {
        ...newItemStat('scaleDegrees', 'resting', now),
        dueAt: new Date(now.getTime() + 86_400_000).toISOString(),
      };
      await subject.saveItemStat(due);
      await subject.saveItemStat(resting);

      expect(await subject.getDueItemKeys('scaleDegrees', now)).toEqual(['due']);
    });

    it('is empty for a mode with no stats', async () => {
      expect(await subject.getItemStats('chords')).toEqual([]);
      expect(await subject.getDueItemKeys('chords')).toEqual([]);
    });
  });

  describe('clear', () => {
    it('wipes everything', async () => {
      await subject.saveSkillProgress(newSkillProgress('scaleDegrees'));
      await subject.recordAnswer(answer());
      await subject.saveItemStat(newItemStat('scaleDegrees', 'x'));

      await subject.clear();

      expect(await subject.getSkillProgress('scaleDegrees')).toBeNull();
      expect(await subject.getRecentAnswers({ mode: 'scaleDegrees' })).toEqual([]);
      expect(await subject.getItemStats('scaleDegrees')).toEqual([]);
    });
  });

  describe('a full practice session', () => {
    it('records the session, its answers and the progress together', async () => {
      const progress = newSkillProgress('scaleDegrees');
      await subject.saveSkillProgress(progress);

      const session = await subject.startSession({
        mode: 'scaleDegrees',
        level: 1,
        kind: 'practice',
        seed: 'run-1',
        questionCount: 20,
      });

      for (let i = 0; i < 20; i += 1) {
        await subject.recordAnswer(
          answer({ sessionId: session.id, correct: i % 4 !== 0, responseMs: 1000 + i }),
        );
      }

      await subject.finishSession(session.id, {
        correctCount: 15,
        accuracy: 0.75,
        medianMs: 1010,
        bestCombo: 3,
      });

      const answers = await subject.getSessionAnswers(session.id);
      expect(answers).toHaveLength(20);
      expect(answers.filter((record) => record.correct)).toHaveLength(15);
      expect((await subject.getSession(session.id))?.accuracy).toBe(0.75);
    });
  });
});
