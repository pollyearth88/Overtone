/**
 * The live session flow: start, answer, advance, finish.
 *
 * The audio engine and IndexedDB are both faked, so what is under test is the
 * sequencing — combo tracking, when progress is written, how a test differs
 * from practice, and that each question is played exactly once.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const kv = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => kv.get(key)),
  set: vi.fn(async (key: string, value: unknown) => {
    kv.set(key, JSON.parse(JSON.stringify(value)));
  }),
  clear: vi.fn(async () => kv.clear()),
}));

const played: string[] = [];

const engine = {
  unlock: vi.fn(async () => {}),
  isUnlocked: vi.fn(() => true),
  loadInstrument: vi.fn(async () => {}),
  isInstrumentLoaded: vi.fn(() => true),
  setInstrument: vi.fn(),
  getInstrument: vi.fn(() => 'piano' as const),
  playNote: vi.fn(async () => {}),
  playChord: vi.fn(async () => {}),
  playSequence: vi.fn(async (events: { kind: string }[]) => {
    played.push(events.map((event) => event.kind).join('+'));
  }),
  playNoiseBurst: vi.fn(async () => {}),
  stopAll: vi.fn(),
  setVolume: vi.fn(),
  getVolume: vi.fn(() => 0.8),
  dispose: vi.fn(),
};

vi.mock('../audio/ToneAudioEngine', () => ({
  getAudioEngine: () => engine,
  resetAudioEngine: () => {},
}));

const { useDrillStore } = await import('./drillStore');
const { getDataStore } = await import('../data/LocalStore');
const { LEVEL_TEST_QUESTION_COUNT, PRACTICE_QUESTION_COUNT } = await import('../learning/mastery');

/** Answers the current question correctly or not, then advances. */
async function answerAll(correct: (index: number) => boolean) {
  for (let guard = 0; guard < 60; guard += 1) {
    const state = useDrillStore.getState();
    if (state.phase === 'summary') break;

    const question = state.questions[state.index];
    if (!question) break;

    const wrong = question.choices.find(
      (choice) => !choice.locked && choice.id !== question.correctChoiceId,
    );
    const choice = correct(state.index)
      ? question.correctChoiceId
      : (wrong?.id ?? question.correctChoiceId);

    await state.answer(choice);

    // Practice waits for the user; a test advances itself.
    if (useDrillStore.getState().phase === 'feedback') {
      await useDrillStore.getState().next();
    }
  }
}

describe('the drill session', () => {
  beforeEach(() => {
    kv.clear();
    played.length = 0;
    vi.clearAllMocks();
    useDrillStore.getState().reset();
  });

  describe('start', () => {
    it('generates a full practice session and begins asking', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'fixed' });
      const state = useDrillStore.getState();
      expect(state.phase).toBe('asking');
      expect(state.questions).toHaveLength(PRACTICE_QUESTION_COUNT);
      expect(state.index).toBe(0);
      expect(state.sessionId).toBeTruthy();
    });

    it('uses the shorter question count for a level test', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'test', seed: 'fixed' });
      expect(useDrillStore.getState().questions).toHaveLength(LEVEL_TEST_QUESTION_COUNT);
    });

    it('creates progress on first run, at the level asked for', async () => {
      await useDrillStore.getState().start({ level: 3, kind: 'practice', seed: 'fixed' });
      const progress = await getDataStore().getSkillProgress('scaleDegrees');
      expect(progress?.level).toBe(3);
      expect(progress?.unlockedChoices).toBe(2);
    });

    it('limits practice to unlocked choices but tests to the whole level', async () => {
      await useDrillStore.getState().start({ level: 4, kind: 'practice', seed: 'fixed' });
      const practice = useDrillStore.getState().questions;
      expect(
        new Set(practice.map((question) => question.correctChoiceId)).size,
      ).toBeLessThanOrEqual(2);

      await useDrillStore.getState().start({ level: 4, kind: 'test', seed: 'fixed' });
      const test = useDrillStore.getState().questions;
      expect(test.every((question) => question.choices.every((choice) => !choice.locked))).toBe(
        true,
      );
    });

    it('records the seed so the set can be replayed', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'replay-me' });
      const state = useDrillStore.getState();
      const session = await getDataStore().getSession(state.sessionId!);
      expect(session?.seed).toBe('replay-me');
    });
  });

  describe('playback', () => {
    it('plays a question exactly once when it becomes current', async () => {
      // The store must not play on advancing — the drill screen owns that, and
      // doing both would sound every question twice.
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'fixed' });
      played.length = 0;

      await useDrillStore.getState().playQuestion();
      expect(played).toHaveLength(1);

      await useDrillStore.getState().next();
      expect(played).toHaveLength(1);
    });

    it('replays just the note, and just the cadence, on request', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'fixed' });
      played.length = 0;

      await useDrillStore.getState().replayNote();
      expect(played).toEqual(['note']);

      played.length = 0;
      await useDrillStore.getState().replayCadence();
      // A cadence is four chords plus a trailing rest.
      expect(played[0]).toMatch(/^chord\+chord\+chord\+chord/);
    });
  });

  describe('answering', () => {
    it('tracks combo and resets it on a miss', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'fixed' });

      const first = useDrillStore.getState().questions[0]!;
      await useDrillStore.getState().answer(first.correctChoiceId);
      expect(useDrillStore.getState().combo).toBe(1);

      await useDrillStore.getState().next();
      const second = useDrillStore.getState().questions[1]!;
      await useDrillStore.getState().answer(second.correctChoiceId);
      expect(useDrillStore.getState().combo).toBe(2);
      expect(useDrillStore.getState().bestCombo).toBe(2);

      await useDrillStore.getState().next();
      const third = useDrillStore.getState().questions[2]!;
      const wrong = third.choices.find(
        (choice) => !choice.locked && choice.id !== third.correctChoiceId,
      )!;
      await useDrillStore.getState().answer(wrong.id);
      expect(useDrillStore.getState().combo).toBe(0);
      // The best is remembered.
      expect(useDrillStore.getState().bestCombo).toBe(2);
    });

    it('moves to feedback on a practice answer', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'fixed' });
      const question = useDrillStore.getState().questions[0]!;
      await useDrillStore.getState().answer(question.correctChoiceId);

      const state = useDrillStore.getState();
      expect(state.phase).toBe('feedback');
      expect(state.lastAnswer?.correct).toBe(true);
      expect(state.lastAnswer?.correctId).toBe(question.correctChoiceId);
    });

    it('records a non-negative response time', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'fixed' });
      await useDrillStore.getState().playQuestion();
      const question = useDrillStore.getState().questions[0]!;
      await useDrillStore.getState().answer(question.correctChoiceId);

      const answer = useDrillStore.getState().lastAnswer!;
      expect(answer.responseMs).toBeGreaterThanOrEqual(0);
      expect(answer.responseMs).toBeLessThan(60_000);
    });

    it('persists the answer with its instrument, octave and key', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'fixed' });
      const state = useDrillStore.getState();
      const question = state.questions[0]!;
      await state.answer(question.correctChoiceId);

      const stored = await getDataStore().getSessionAnswers(state.sessionId!);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        itemKey: question.itemKey,
        correctId: question.correctChoiceId,
        correct: true,
        instrument: question.voicing.instrument,
        octave: question.voicing.octave,
      });
      expect(stored[0]?.keyId).toBeTruthy();
    });

    it('advances a level test immediately, with no feedback phase', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'test', seed: 'fixed' });
      const question = useDrillStore.getState().questions[0]!;
      await useDrillStore.getState().answer(question.correctChoiceId);

      const state = useDrillStore.getState();
      expect(state.phase).toBe('asking');
      expect(state.index).toBe(1);
    });

    it('ignores an answer when not asking', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'fixed' });
      const question = useDrillStore.getState().questions[0]!;
      await useDrillStore.getState().answer(question.correctChoiceId);
      // Already in feedback; a second answer must not double-count.
      await useDrillStore.getState().answer(question.correctChoiceId);
      expect(useDrillStore.getState().answers).toHaveLength(1);
    });

    it('updates Leitner state for the item answered', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'fixed' });
      const question = useDrillStore.getState().questions[0]!;
      await useDrillStore.getState().answer(question.correctChoiceId);

      const stats = await getDataStore().getItemStats('scaleDegrees');
      const stat = stats.find((candidate) => candidate.itemKey === question.itemKey);
      expect(stat?.box).toBe(2);
      expect(stat?.seen).toBe(1);
    });

    it('still schedules review during a test, even without feedback', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'test', seed: 'fixed' });
      const question = useDrillStore.getState().questions[0]!;
      await useDrillStore.getState().answer(question.correctChoiceId);

      const stats = await getDataStore().getItemStats('scaleDegrees');
      expect(stats.length).toBeGreaterThan(0);
    });

    it('does not move the adaptive goalposts during a test', async () => {
      await useDrillStore.getState().start({ level: 4, kind: 'test', seed: 'fixed' });
      await answerAll(() => true);
      const progress = await getDataStore().getSkillProgress('scaleDegrees');
      // Passing the test unlocks the next level, but never adds choices.
      expect(progress?.unlockedChoices).toBe(2);
    });
  });

  describe('finishing', () => {
    it('summarises a practice session', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'fixed' });
      await answerAll((index) => index % 2 === 0);

      const state = useDrillStore.getState();
      expect(state.phase).toBe('summary');
      expect(state.answers).toHaveLength(PRACTICE_QUESTION_COUNT);
      expect(state.answers.filter((answer) => answer.correct)).toHaveLength(10);
    });

    it('writes the outcome to the session record', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'fixed' });
      const sessionId = useDrillStore.getState().sessionId!;
      await answerAll(() => true);

      const session = await getDataStore().getSession(sessionId);
      expect(session?.endedAt).toBeTruthy();
      expect(session?.accuracy).toBe(1);
      expect(session?.correctCount).toBe(PRACTICE_QUESTION_COUNT);
    });

    it('passes a level test at 90% and unlocks the next level', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'test', seed: 'fixed' });
      await answerAll(() => true);

      const state = useDrillStore.getState();
      expect(state.phase).toBe('summary');
      expect(state.testPassed).toBe(true);
      expect(state.unlockedLevel).toBe(2);

      const progress = await getDataStore().getSkillProgress('scaleDegrees');
      expect(progress?.masteredLevels).toEqual([1]);
      expect(progress?.highestUnlockedLevel).toBe(2);
    });

    it('fails a level test below the pass mark and changes nothing', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'test', seed: 'fixed' });
      // 10 of 15 is well short of the 14 needed.
      await answerAll((index) => index < 10);

      const state = useDrillStore.getState();
      expect(state.testPassed).toBe(false);
      expect(state.unlockedLevel).toBeNull();

      const progress = await getDataStore().getSkillProgress('scaleDegrees');
      expect(progress?.masteredLevels).toEqual([]);
      expect(progress?.highestUnlockedLevel).toBe(1);
    });

    it('can be ended early, and summarises only what was answered', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'fixed' });
      const question = useDrillStore.getState().questions[0]!;
      await useDrillStore.getState().answer(question.correctChoiceId);
      await useDrillStore.getState().finish();

      const state = useDrillStore.getState();
      expect(state.phase).toBe('summary');
      expect(state.answers).toHaveLength(1);
    });

    it('stops audio when finishing', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'fixed' });
      await useDrillStore.getState().finish();
      expect(engine.stopAll).toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('clears the session and silences audio', async () => {
      await useDrillStore.getState().start({ level: 1, kind: 'practice', seed: 'fixed' });
      useDrillStore.getState().reset();

      const state = useDrillStore.getState();
      expect(state.phase).toBe('idle');
      expect(state.questions).toEqual([]);
      expect(state.answers).toEqual([]);
      expect(engine.stopAll).toHaveBeenCalled();
    });
  });

  describe('the same seed replays the same session', () => {
    it('asks identical questions', async () => {
      await useDrillStore.getState().start({ level: 4, kind: 'test', seed: 'same' });
      const first = useDrillStore.getState().questions.map((q) => q.correctChoiceId);

      useDrillStore.getState().reset();
      await useDrillStore.getState().start({ level: 4, kind: 'test', seed: 'same' });
      const second = useDrillStore.getState().questions.map((q) => q.correctChoiceId);

      expect(second).toEqual(first);
    });
  });
});
