'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { DegreeGrid } from './DegreeGrid';
import { DrillHeader } from './DrillHeader';
import { FeedbackBar } from './FeedbackBar';
import { PlayButton } from './PlayButton';
import { SessionSummary } from './SessionSummary';
import { getInstrument } from '@/lib/audio/instruments';
import { useDrillStore } from '@/lib/session/drillStore';
import { keyLabel } from '@/lib/theory/keys';
import { levelSpec } from '@/lib/modes/scaleDegrees';
import { degreeForShortcut, numberFromKeyCode } from '@/lib/modes/degreeShortcuts';
import { ADAPTIVE_MIN_ACCURACY, ADAPTIVE_WINDOW } from '@/lib/learning/adaptive';

export interface ScaleDegreeDrillProps {
  level: number;
  kind: 'practice' | 'test';
}

/** Matches `--animate-shake` in globals.css. */
const SHAKE_MS = 320;

export function ScaleDegreeDrill({ level, kind }: ScaleDegreeDrillProps) {
  const router = useRouter();
  const [shake, setShake] = useState<{ id: string | null; nonce: number }>({
    id: null,
    nonce: 0,
  });

  const phase = useDrillStore((state) => state.phase);
  const error = useDrillStore((state) => state.error);
  const questions = useDrillStore((state) => state.questions);
  const index = useDrillStore((state) => state.index);
  const answers = useDrillStore((state) => state.answers);
  const combo = useDrillStore((state) => state.combo);
  const bestCombo = useDrillStore((state) => state.bestCombo);
  const lastAnswer = useDrillStore((state) => state.lastAnswer);
  const unlockedChoice = useDrillStore((state) => state.unlockedChoice);
  const isPlaying = useDrillStore((state) => state.isPlaying);
  const settings = useDrillStore((state) => state.settings);
  const testPassed = useDrillStore((state) => state.testPassed);
  const unlockedLevel = useDrillStore((state) => state.unlockedLevel);

  const start = useDrillStore((state) => state.start);
  const answer = useDrillStore((state) => state.answer);
  const next = useDrillStore((state) => state.next);
  const finish = useDrillStore((state) => state.finish);
  const reset = useDrillStore((state) => state.reset);
  const replayNote = useDrillStore((state) => state.replayNote);
  const replayCadence = useDrillStore((state) => state.replayCadence);

  const question = questions[index];
  const spec = levelSpec(level);

  // One session per mount. `reset` on unmount stops any audio still sounding.
  useEffect(() => {
    void start({ level, kind });
    return () => reset();
  }, [start, reset, level, kind]);

  /**
   * Desktop shortcuts. A number key is the degree as the current key writes it,
   * Shift reaches the altered one; space replays the note, C the cadence, Enter
   * advances. Registered on `window` rather than a focused element, because the
   * drill has nothing that holds focus.
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Shift is part of the answer chord here, so only the other modifiers bail.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }

      const state = useDrillStore.getState();
      const current = state.questions[state.index];
      if (!current) return;

      if (event.key === ' ') {
        event.preventDefault();
        void state.replayNote();
        return;
      }
      if (event.key === 'c' || event.key === 'C') {
        event.preventDefault();
        void state.replayCadence();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (state.phase === 'feedback') void state.next();
        return;
      }

      if (state.phase !== 'asking') return;

      const number = numberFromKeyCode(event.code);
      if (number === null) return;

      const degree = degreeForShortcut(number, event.shiftKey, current.voicing.key.mode);
      if (!degree) return;

      const choice = current.choices.find((candidate) => candidate.id === degree);
      // The degree is not on this level at all: not our key press.
      if (!choice) return;

      event.preventDefault();

      if (choice.locked) {
        // Say "not yet" rather than silently swallowing the press.
        setShake((previous) => ({ id: degree, nonce: previous.nonce + 1 }));
        return;
      }

      void state.answer(choice.id);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Clear the shake once its animation has run, so the class comes back off.
  useEffect(() => {
    if (shake.id === null) return;
    const timer = setTimeout(() => setShake({ id: null, nonce: 0 }), SHAKE_MS);
    return () => clearTimeout(timer);
  }, [shake]);

  /**
   * Plays whichever question has just become current.
   *
   * This is the *only* place a question is played automatically — the store
   * deliberately does not play on advancing, or every question after the first
   * would sound twice. Keyed on the question id so a re-render mid-question
   * does not replay it.
   */
  const questionId = question?.id;
  useEffect(() => {
    if (phase !== 'asking' || questionId === undefined) return;
    void useDrillStore.getState().playQuestion();
  }, [phase, questionId]);

  const close = () => {
    reset();
    router.push('/learn');
  };

  if (phase === 'error') {
    return (
      <main id="main" className="pt-2">
        <h1 className="text-xl font-semibold">Could not start the drill</h1>
        <Card className="border-danger/40 mt-4">
          <p className="text-sm">{error ?? 'Something went wrong.'}</p>
        </Card>
        <Button className="mt-4" onClick={() => void start({ level, kind })}>
          Try again
        </Button>
      </main>
    );
  }

  if (phase === 'summary') {
    return (
      <SessionSummary
        answers={answers}
        level={level}
        bestCombo={bestCombo}
        kind={kind}
        passed={testPassed}
        unlockedLevel={unlockedLevel}
        onPracticeAgain={() => void start({ level, kind: 'practice' })}
        onTakeTest={() => void start({ level, kind: 'test' })}
      />
    );
  }

  if (phase === 'loading' || !question) {
    return (
      <main id="main" className="pt-2">
        <p className="text-muted font-mono text-sm">Loading sounds…</p>
      </main>
    );
  }

  const instrument = getInstrument(question.voicing.instrument);
  const unlockedCount = question.choices.filter((choice) => !choice.locked).length;
  const lockedCount = question.choices.length - unlockedCount;
  const showFeedback = phase === 'feedback' && lastAnswer !== null;
  // Auto-advance handles the Next button on a correct answer, so showing one
  // would just race the timer.
  const showNextButton = showFeedback && !(lastAnswer.correct && settings.autoAdvance);

  return (
    <main id="main" className="flex min-h-[calc(100dvh-5rem)] flex-col gap-4 pt-1">
      <DrillHeader
        questionNumber={index + 1}
        questionCount={questions.length}
        combo={combo}
        onClose={close}
      />

      <div className="flex flex-wrap gap-2">
        <Chip>{keyLabel(question.voicing.key)}</Chip>
        <Chip>{instrument.label}</Chip>
        <Chip>
          {index + 1}/{questions.length}
        </Chip>
        {kind === 'test' ? <Chip tone="accent">Level {level} test</Chip> : null}
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        <PlayButton
          onClick={() => void replayNote()}
          isPlaying={isPlaying}
          label="Replay the note"
        />
        <Button
          variant="ghost"
          onClick={() => void replayCadence()}
          disabled={question.reference.length === 0}
        >
          Replay cadence
        </Button>
      </div>

      <h1 className="text-center text-lg font-semibold">{question.promptText}</h1>

      <DegreeGrid
        choices={question.choices}
        onAnswer={(choiceId) => void answer(choiceId)}
        keyMode={question.voicing.key.mode}
        disabled={phase !== 'asking'}
        correctId={showFeedback ? lastAnswer.correctId : null}
        chosenId={showFeedback ? lastAnswer.chosenId : null}
        shakeId={shake.id}
        shakeNonce={shake.nonce}
      />

      {lockedCount > 0 ? (
        <p className="text-muted text-center text-xs">
          {unlockedCount} of {question.choices.length} unlocked — get{' '}
          {Math.round(ADAPTIVE_MIN_ACCURACY * 100)}% over {ADAPTIVE_WINDOW} answers to unlock the
          next one
        </p>
      ) : null}

      <p className="text-muted hidden text-center text-xs sm:block">
        Number = degree · Shift = altered · Space replays the note · C replays the cadence · Enter
        for next
      </p>

      <div className="mt-auto pt-2">
        {showFeedback ? (
          <FeedbackBar
            correct={lastAnswer.correct}
            correctId={lastAnswer.correctId}
            chosenId={lastAnswer.chosenId}
            responseMs={lastAnswer.responseMs}
            unlockedChoice={unlockedChoice}
            onNext={() => void next()}
            showNext={showNextButton}
          />
        ) : kind === 'test' ? (
          <p className="text-muted text-center text-xs">No feedback during a test — {spec.label}</p>
        ) : (
          <Button variant="ghost" fullWidth onClick={() => void finish()}>
            End session early
          </Button>
        )}
      </div>
    </main>
  );
}
