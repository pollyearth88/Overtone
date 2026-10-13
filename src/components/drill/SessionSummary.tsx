'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StatPill } from '@/components/ui/StatPill';
import { CheckIcon, FlameIcon, TargetIcon, ClockIcon, XIcon } from '@/components/ui/icons';
import {
  levelTestPassMark,
  summariseAnswers,
  weakestItems,
  type BreakdownAnswer,
} from '@/lib/learning/mastery';
import { degreeLabel, isDegree, solfege } from '@/lib/theory/degrees';
import { MAX_SCALE_DEGREE_LEVEL } from '@/lib/modes/scaleDegrees';

export interface SessionSummaryProps {
  answers: readonly BreakdownAnswer[];
  level: number;
  bestCombo: number;
  kind: 'practice' | 'test';
  /** Test only. */
  passed?: boolean | null;
  unlockedLevel?: number | null;
  onPracticeAgain: () => void;
  onTakeTest: () => void;
}

function label(id: string): string {
  return isDegree(id) ? `${degreeLabel(id)} · ${solfege(id)}` : id;
}

export function SessionSummary({
  answers,
  level,
  bestCombo,
  kind,
  passed = null,
  unlockedLevel = null,
  onPracticeAgain,
  onTakeTest,
}: SessionSummaryProps) {
  const summary = summariseAnswers(answers);
  const weakest = weakestItems(answers);
  const isTest = kind === 'test';
  const canTest = level <= MAX_SCALE_DEGREE_LEVEL;

  return (
    <main id="main" className="flex flex-col gap-5 pt-2">
      <header>
        <p className="text-muted font-mono text-xs tracking-wide uppercase">
          {isTest ? `Level ${level} test` : `Level ${level} practice`}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {isTest ? (passed ? 'Test passed' : 'Test not passed') : 'Session complete'}
        </h1>
      </header>

      {isTest ? (
        <Card
          className={
            passed ? 'border-success/40 bg-success-tint' : 'border-danger/40 bg-danger-tint'
          }
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                passed ? 'bg-success text-success-tint' : 'bg-danger text-danger-tint'
              }`}
            >
              {passed ? <CheckIcon className="size-4" /> : <XIcon className="size-4" />}
            </span>
            <div>
              <p className={`font-medium ${passed ? 'text-success' : 'text-danger'}`}>
                {summary.correct} of {summary.total} correct — {levelTestPassMark(summary.total)}{' '}
                needed to pass
              </p>
              <p className="mt-1 text-sm">
                {passed
                  ? unlockedLevel !== null
                    ? `Level ${unlockedLevel} is now unlocked.`
                    : 'This was the last level — the whole ladder is yours.'
                  : 'Nothing was lost. Practise a little more and retake it whenever you like.'}
              </p>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <StatPill
          label="Accuracy"
          value={`${Math.round(summary.accuracy * 100)}%`}
          icon={<TargetIcon className="size-4" />}
        />
        <StatPill
          label="Median"
          value={`${(summary.medianMs / 1000).toFixed(1)}s`}
          icon={<ClockIcon className="size-4" />}
        />
        <StatPill
          label="Best combo"
          value={String(bestCombo)}
          icon={<FlameIcon className="size-4" />}
        />
      </div>

      <section aria-labelledby="weakest">
        <h2 id="weakest" className="mb-2 text-base font-semibold">
          {weakest.length > 0 ? 'Worth another look' : 'Nothing missed'}
        </h2>

        {weakest.length === 0 ? (
          <Card>
            <p className="text-sm">Every degree correct. Try the level test, or move up a level.</p>
          </Card>
        ) : (
          <ul className="flex flex-col gap-2">
            {weakest.map((item) => (
              <li key={item.itemKey}>
                <Card className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium">{label(item.id)}</p>
                    {item.confusedWith.length > 0 ? (
                      <p className="text-muted mt-0.5 text-xs">
                        heard as{' '}
                        {item.confusedWith.map((confusion) => label(confusion.id)).join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-muted shrink-0 font-mono text-xs whitespace-nowrap">
                    {item.correct}/{item.seen}
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-2">
        <Button fullWidth size="lg" onClick={onPracticeAgain}>
          Practice again
        </Button>
        {canTest ? (
          <Button fullWidth size="lg" variant="outline" onClick={onTakeTest}>
            {isTest ? 'Retake level test' : 'Take level test'}
          </Button>
        ) : null}
        <Link
          href="/learn"
          className="text-muted rounded-control hover:bg-track/60 flex min-h-11 items-center justify-center text-sm"
        >
          Back to Learn
        </Link>
      </div>
    </main>
  );
}
