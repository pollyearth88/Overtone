'use client';

import { Button } from '@/components/ui/Button';
import { CheckIcon, XIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { DEGREE_FEEL, degreeLabel, isDegree, solfege } from '@/lib/theory/degrees';

export interface FeedbackBarProps {
  correct: boolean;
  correctId: string;
  chosenId: string;
  responseMs: number;
  /** Shown when the adaptive rule just earned a new answer choice. */
  unlockedChoice?: boolean;
  onNext: () => void;
  /** Hidden while auto-advance is about to fire anyway. */
  showNext?: boolean;
}

function describe(id: string): { label: string; solfege: string; feel: string } {
  // Guards against an id from a future mode that isn't a scale degree.
  if (!isDegree(id)) return { label: id, solfege: '', feel: '' };
  return { label: degreeLabel(id), solfege: solfege(id), feel: DEGREE_FEEL[id] };
}

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * The bar along the bottom of the drill.
 *
 * Never colour alone: right gets a check icon plus the word, wrong gets an X
 * plus the correct answer spelled out. The one-line "feel" description is the
 * part that actually teaches — naming the sensation is what makes a degree
 * stick, so it shows on right answers too, not just wrong ones.
 */
export function FeedbackBar({
  correct,
  correctId,
  chosenId,
  responseMs,
  unlockedChoice = false,
  onNext,
  showNext = true,
}: FeedbackBarProps) {
  const target = describe(correctId);
  const picked = describe(chosenId);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'rounded-card border p-3',
        correct ? 'bg-success-tint border-success/40' : 'bg-danger-tint border-danger/40',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
            correct ? 'bg-success text-success-tint' : 'bg-danger text-danger-tint',
          )}
        >
          {correct ? <CheckIcon className="size-4" /> : <XIcon className="size-4" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className={cn('font-medium', correct ? 'text-success' : 'text-danger')}>
            {correct ? 'Correct' : 'Not quite'} —{' '}
            <span className="font-mono">
              {target.label}
              {target.solfege ? ` · ${target.solfege}` : ''}
            </span>
            {correct ? (
              <span className="text-muted font-mono text-sm"> · {formatSeconds(responseMs)}</span>
            ) : null}
          </p>

          {!correct ? (
            <p className="text-muted mt-0.5 text-sm">
              You chose <span className="font-mono">{picked.label}</span>
              {picked.solfege ? ` · ${picked.solfege}` : ''}
            </p>
          ) : null}

          {target.feel ? <p className="mt-1 text-sm">{target.feel}</p> : null}

          {unlockedChoice ? (
            <p className="text-accent-strong mt-1.5 text-sm font-medium">
              New answer unlocked — nice work.
            </p>
          ) : null}
        </div>

        {showNext ? (
          <Button onClick={onNext} className="shrink-0 self-center">
            Next
          </Button>
        ) : null}
      </div>
    </div>
  );
}
