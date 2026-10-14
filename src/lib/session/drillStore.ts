/**
 * The live drill session.
 *
 * Zustand rather than React state because three separate things need to read
 * and drive it — the drill screen, the feedback bar and the keyboard shortcut
 * handler — and because the audio callbacks that resolve mid-question are not
 * tied to a render.
 *
 * The store owns *session* state only. Durable progress goes through
 * `DataStore`; the rules for how an answer changes progress live in
 * `lib/learning`. This file decides nothing about progression — it sequences the
 * session and reports what happened.
 */

import { create } from 'zustand';

import { getAudioEngine } from '../audio/ToneAudioEngine';
import type { InstrumentId } from '../audio/instruments';
import { getDataStore } from '../data/LocalStore';
import type { SkillProgress } from '../data/types';
import { applyAnswer, applyLevelTest, newSkillProgress, setLevel } from '../learning/progress';
import { ADAPTIVE_WINDOW } from '../learning/adaptive';
import {
  LEVEL_TEST_QUESTION_COUNT,
  PRACTICE_QUESTION_COUNT,
  summariseAnswers,
} from '../learning/mastery';
import {
  DEFAULT_CADENCE_GAP_SECONDS,
  carriesForwardInto,
  levelChoiceCount,
  levelStarterCount,
  questionSequence,
  scaleDegreesGenerator,
  unlockedChoiceIds,
} from '../modes/scaleDegrees';
import type { Question, SessionKind } from '../modes/types';
import { keyId } from '../theory/keys';

/** Where the drill is in the question loop. */
export type DrillPhase = 'idle' | 'loading' | 'asking' | 'feedback' | 'summary' | 'error';

export interface GivenAnswer {
  questionId: string;
  itemKey: string;
  chosenId: string;
  correctId: string;
  correct: boolean;
  responseMs: number;
}

export interface DrillSettings {
  instruments: readonly InstrumentId[];
  /** Auto-advance after a correct answer. The spec makes this switchable. */
  autoAdvance: boolean;
  /**
   * Milliseconds to hold correct feedback before advancing. Long enough to read
   * the degree name and its "feel" line without the session dragging.
   */
  autoAdvanceMs: number;
  /**
   * Milliseconds between the cadence ending and the target note sounding.
   * Long enough for the key to settle, short enough that the two still feel
   * like one phrase.
   */
  cadenceGapMs: number;
}

/**
 * Both timings were checked by ear and left where they are. Phase 4's Settings
 * page takes ownership of all four of these.
 */
export const DEFAULT_DRILL_SETTINGS: DrillSettings = {
  instruments: ['piano', 'guitar-acoustic', 'guitar-electric', 'cello', 'flute'],
  autoAdvance: true,
  autoAdvanceMs: 1400,
  cadenceGapMs: DEFAULT_CADENCE_GAP_SECONDS * 1000,
};

interface StartOptions {
  level: number;
  kind: Extract<SessionKind, 'practice' | 'test'>;
  settings?: Partial<DrillSettings>;
  /** Fixed seed, for replaying a set. Defaults to a fresh random one. */
  seed?: string;
}

interface DrillState {
  phase: DrillPhase;
  error: string | null;

  sessionId: string | null;
  kind: SessionKind;
  level: number;
  seed: string;

  questions: readonly Question[];
  index: number;
  answers: readonly GivenAnswer[];

  /** Combo of consecutive correct answers, and the session's best. */
  combo: number;
  bestCombo: number;

  /** The answer just given, while `phase === 'feedback'`. */
  lastAnswer: GivenAnswer | null;
  /** Set for one question when the adaptive rule just earned a new choice. */
  unlockedChoice: boolean;

  settings: DrillSettings;
  progress: SkillProgress | null;
  /** True for a passed level test, once the summary is reached. */
  testPassed: boolean | null;
  unlockedLevel: number | null;

  /** Whether audio is currently sounding, so the play button can show it. */
  isPlaying: boolean;

  start(options: StartOptions): Promise<void>;
  /** Plays the cadence (if the level allows) then the target note. */
  playQuestion(): Promise<void>;
  /** Plays just the target note — the big round button. */
  replayNote(): Promise<void>;
  /** Plays just the cadence — the "Replay cadence" button. */
  replayCadence(): Promise<void>;
  answer(choiceId: string): Promise<void>;
  next(): Promise<void>;
  finish(): Promise<void>;
  reset(): void;
}

const MODE = 'scaleDegrees' as const;

/** Monotonic clock for response times, so a system clock change can't skew them. */
function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function randomSeed(): string {
  return `s${Math.trunc(Math.random() * 0xffffffff)}`;
}

export const useDrillStore = create<DrillState>((set, getState) => {
  /** When the current question's audio finished, for the response timer. */
  let askedAt = 0;
  let autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

  const clearAutoAdvance = () => {
    if (autoAdvanceTimer !== null) {
      clearTimeout(autoAdvanceTimer);
      autoAdvanceTimer = null;
    }
  };

  /** Plays events and keeps `isPlaying` honest even if playback throws. */
  const play = async (events: Parameters<ReturnType<typeof getAudioEngine>['playSequence']>[0]) => {
    const engine = getAudioEngine();
    set({ isPlaying: true });
    try {
      await engine.unlock();
      await engine.playSequence(events);
    } finally {
      set({ isPlaying: false });
    }
  };

  return {
    phase: 'idle',
    error: null,
    sessionId: null,
    kind: 'practice',
    level: 1,
    seed: '',
    questions: [],
    index: 0,
    answers: [],
    combo: 0,
    bestCombo: 0,
    lastAnswer: null,
    unlockedChoice: false,
    settings: DEFAULT_DRILL_SETTINGS,
    progress: null,
    testPassed: null,
    unlockedLevel: null,
    isPlaying: false,

    async start(options) {
      clearAutoAdvance();
      const store = getDataStore();
      const settings = { ...DEFAULT_DRILL_SETTINGS, ...options.settings };
      const seed = options.seed ?? randomSeed();

      set({
        phase: 'loading',
        error: null,
        kind: options.kind,
        level: options.level,
        seed,
        settings,
        questions: [],
        index: 0,
        answers: [],
        combo: 0,
        bestCombo: 0,
        lastAnswer: null,
        unlockedChoice: false,
        testPassed: null,
        unlockedLevel: null,
      });

      try {
        const existing = (await store.getSkillProgress(MODE)) ?? newSkillProgress(MODE);

        // A level starts with everything the level below it ended with, plus
        // its first new item — not a flat two. Whether those carry forward
        // depends on having actually mastered the level below.
        const carriedForward = carriesForwardInto(options.level, existing.masteredLevels);
        const progress = setLevel(
          existing,
          options.level,
          levelStarterCount(options.level, carriedForward),
        );
        if (progress !== existing) await store.saveSkillProgress(progress);

        const count = options.kind === 'test' ? LEVEL_TEST_QUESTION_COUNT : PRACTICE_QUESTION_COUNT;

        const session = await store.startSession({
          mode: MODE,
          level: options.level,
          kind: options.kind,
          seed,
          questionCount: count,
        });

        const { questions } = scaleDegreesGenerator.generate({
          seed,
          level: options.level,
          count,
          kind: options.kind,
          dueItemKeys: await store.getDueItemKeys(MODE),
          settings: {
            instruments: settings.instruments,
            // A test measures the level, so it asks the whole level. Practice
            // only asks what the adaptive rule has unlocked.
            ...(options.kind === 'test'
              ? {}
              : {
                  unlockedChoiceIds: unlockedChoiceIds(
                    options.level,
                    progress.unlockedChoices,
                    carriedForward,
                  ),
                }),
          },
        });

        set({
          sessionId: session.id,
          questions,
          progress,
          phase: 'asking',
        });

        // Warm the instruments this session will use, so the first question
        // does not sit silent while samples arrive.
        const engine = getAudioEngine();
        await Promise.all(
          [...new Set(questions.map((question) => question.voicing.instrument))].map((id) =>
            engine.loadInstrument(id),
          ),
        );
      } catch (cause) {
        set({
          phase: 'error',
          error: cause instanceof Error ? cause.message : String(cause),
        });
      }
    },

    async playQuestion() {
      const { questions, index } = getState();
      const question = questions[index];
      if (!question) return;

      // Floor for the response clock, in case the user answers while the audio
      // is still playing — without this, an early answer would be measured
      // against the *previous* question and come out absurdly long.
      askedAt = now();

      await play(questionSequence(question, getState().settings.cadenceGapMs / 1000));

      // Normally the clock starts when the sound stops, so a long cadence is
      // not counted as thinking time.
      askedAt = now();
    },

    async replayNote() {
      const { questions, index } = getState();
      const question = questions[index];
      if (!question) return;
      await play(question.audio);
    },

    async replayCadence() {
      const { questions, index } = getState();
      const question = questions[index];
      if (!question || question.reference.length === 0) return;
      await play(question.reference);
    },

    async answer(choiceId) {
      const state = getState();
      const question = state.questions[state.index];
      if (!question || state.phase !== 'asking') return;

      const correct = choiceId === question.correctChoiceId;
      const responseMs = Math.max(0, Math.round(now() - askedAt));

      const given: GivenAnswer = {
        questionId: question.id,
        itemKey: question.itemKey,
        chosenId: choiceId,
        correctId: question.correctChoiceId,
        correct,
        responseMs,
      };

      const combo = correct ? state.combo + 1 : 0;
      const answers = [...state.answers, given];

      set({
        answers,
        combo,
        bestCombo: Math.max(state.bestCombo, combo),
        lastAnswer: given,
        phase: 'feedback',
        unlockedChoice: false,
      });

      // Persist and update progress. Awaited so the next question's due-items
      // and choice count reflect this answer.
      try {
        const store = getDataStore();
        if (state.sessionId) {
          await store.recordAnswer({
            sessionId: state.sessionId,
            mode: MODE,
            level: state.level,
            itemKey: question.itemKey,
            chosenId: choiceId,
            correctId: question.correctChoiceId,
            correct,
            responseMs,
            instrument: question.voicing.instrument,
            octave: question.voicing.octave,
            keyId: keyId(question.voicing.key),
          });
        }

        // The adaptive rule only applies while practising: a test must not
        // move the goalposts it is measuring against.
        if (state.kind === 'practice' && state.progress) {
          const stats = await store.getItemStats(MODE);
          const stat = stats.find((candidate) => candidate.itemKey === question.itemKey) ?? null;

          const recent = await store.getRecentAnswers({
            mode: MODE,
            level: state.level,
            since: state.progress.choicesUnlockedAt,
            limit: ADAPTIVE_WINDOW,
          });

          const result = applyAnswer({
            progress: state.progress,
            stat,
            itemKey: question.itemKey,
            correct,
            // getRecentAnswers is newest-first; the window wants chronological.
            answersSinceUnlock: [...recent].reverse(),
            totalChoices: levelChoiceCount(state.level),
          });

          await Promise.all([
            store.saveSkillProgress(result.progress),
            store.saveItemStat(result.stat),
          ]);
          set({ progress: result.progress, unlockedChoice: result.unlockedChoice });
        } else if (state.progress) {
          // Still record the Leitner move during a test — the review schedule
          // should learn from every answer, even an unfed-back one.
          const stats = await store.getItemStats(MODE);
          const stat = stats.find((candidate) => candidate.itemKey === question.itemKey) ?? null;
          const result = applyAnswer({
            progress: state.progress,
            stat,
            itemKey: question.itemKey,
            correct,
            answersSinceUnlock: [],
            totalChoices: levelChoiceCount(state.level),
          });
          await store.saveItemStat(result.stat);
        }
      } catch {
        // A storage failure must not cost the user their session. The answer
        // is already in memory and the summary will still be right.
      }

      const after = getState();

      // A level test shows no feedback, so it advances straight away.
      if (after.kind === 'test') {
        await after.next();
        return;
      }

      if (correct && after.settings.autoAdvance) {
        clearAutoAdvance();
        autoAdvanceTimer = setTimeout(() => {
          autoAdvanceTimer = null;
          void getState().next();
        }, after.settings.autoAdvanceMs);
      } else if (!correct) {
        // Wrong: play the tonic next to the target so the gap is audible.
        await play(question.feedbackAudio);
      }
    },

    async next() {
      clearAutoAdvance();
      const state = getState();
      if (state.index + 1 >= state.questions.length) {
        await state.finish();
        return;
      }

      // Advancing does not play the question. The drill screen has an effect
      // that plays whichever question is current, so playing here too would
      // sound every question twice.
      set({
        index: state.index + 1,
        phase: 'asking',
        lastAnswer: null,
        unlockedChoice: false,
      });
    },

    async finish() {
      clearAutoAdvance();
      const state = getState();
      getAudioEngine().stopAll();

      const summary = summariseAnswers(state.answers);
      let testPassed: boolean | null = null;
      let unlockedLevel: number | null = null;

      try {
        const store = getDataStore();

        if (state.kind === 'test' && state.progress) {
          const result = applyLevelTest({
            progress: state.progress,
            level: state.level,
            answers: state.answers,
            maxLevel: scaleDegreesGenerator.maxLevel,
          });
          testPassed = result.passed;
          unlockedLevel = result.unlockedLevel;
          await store.saveSkillProgress(result.progress);
          set({ progress: result.progress });
        }

        if (state.sessionId) {
          await store.finishSession(state.sessionId, {
            correctCount: summary.correct,
            accuracy: summary.accuracy,
            medianMs: summary.medianMs,
            bestCombo: state.bestCombo,
            ...(testPassed === null ? {} : { passed: testPassed }),
          });
        }
      } catch {
        // Same reasoning as in `answer`: never lose the summary to storage.
      }

      set({ phase: 'summary', testPassed, unlockedLevel });
    },

    reset() {
      clearAutoAdvance();
      getAudioEngine().stopAll();
      set({
        phase: 'idle',
        error: null,
        sessionId: null,
        questions: [],
        index: 0,
        answers: [],
        combo: 0,
        bestCombo: 0,
        lastAnswer: null,
        unlockedChoice: false,
        testPassed: null,
        unlockedLevel: null,
        isPlaying: false,
      });
    },
  };
});
