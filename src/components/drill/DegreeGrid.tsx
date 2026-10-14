'use client';

import { LockIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';
import { shortcutForDegree, shortcutLabel } from '@/lib/modes/degreeShortcuts';
import type { AnswerChoice } from '@/lib/modes/types';
import type { KeyMode } from '@/lib/theory/keys';

export interface DegreeGridProps {
  choices: readonly AnswerChoice[];
  onAnswer: (choiceId: string) => void;
  /** Which key the question is in — decides what the number keys mean. */
  keyMode: KeyMode;
  disabled?: boolean;
  /** Highlighted after an answer: the one that was right. */
  correctId?: string | null;
  /** Highlighted after a wrong answer: the one that was picked. */
  chosenId?: string | null;
  /** A locked choice whose shortcut was pressed — shakes to say "not yet". */
  shakeId?: string | null;
  /** Bumped on each shake so the same button can shake twice in a row. */
  shakeNonce?: number;
}

/**
 * Columns by answer count, so no row is ever left with one orphan button.
 *
 * 2-4 fit one row; 5-8 go two rows of four; nine makes a square 3x3; twelve
 * makes 4x3. Written as a lookup rather than built from a template string
 * because Tailwind only emits classes it can see.
 */
function gridColumns(count: number): string {
  if (count <= 2) return 'grid-cols-2';
  if (count === 3) return 'grid-cols-3';
  if (count === 9) return 'grid-cols-3';
  return 'grid-cols-4';
}

/**
 * The answer buttons: number on top, solfège under it, keyboard shortcut in the
 * corner.
 *
 * Locked choices stay on screen — seeing that `b3` and `b6` are coming is part
 * of what makes the unlock feel earned — but they are unmistakably not
 * available: no fill, a dashed border, muted text and a lock. They are
 * genuinely `disabled` rather than merely dimmed, so they take no clicks and sit
 * outside the tab order.
 */
export function DegreeGrid({
  choices,
  onAnswer,
  keyMode,
  disabled = false,
  correctId = null,
  chosenId = null,
  shakeId = null,
  shakeNonce = 0,
}: DegreeGridProps) {
  const revealing = correctId !== null;

  return (
    <div className={cn('grid gap-2', gridColumns(choices.length))}>
      {choices.map((choice) => {
        const locked = choice.locked ?? false;
        const isCorrect = revealing && choice.id === correctId;
        const isWrongPick = revealing && choice.id === chosenId && chosenId !== correctId;
        const shortcut = shortcutForDegree(choice.id, keyMode);
        const shaking = locked && shakeId === choice.id;

        return (
          <button
            // Including the nonce remounts the button so the shake animation
            // restarts; a repeated press on the same locked degree should
            // visibly shake again rather than sit still.
            key={shaking ? `${choice.id}-${shakeNonce}` : choice.id}
            type="button"
            disabled={disabled || locked}
            aria-disabled={locked || undefined}
            tabIndex={locked ? -1 : undefined}
            onClick={() => onAnswer(choice.id)}
            aria-label={[
              choice.label,
              choice.sublabel,
              locked ? 'locked' : null,
              !locked && shortcut ? `shortcut ${shortcutLabel(shortcut)}` : null,
            ]
              .filter(Boolean)
              .join(', ')}
            className={cn(
              'rounded-control relative flex min-h-16 flex-col items-center justify-center gap-0.5 border transition-colors duration-150',
              'disabled:cursor-not-allowed',
              // Available and waiting for an answer.
              !revealing &&
                !locked &&
                'bg-surface border-border hover:border-primary/50 active:bg-track',
              // Not yet earned: no fill, dashed, muted.
              locked && 'text-muted border-border border-dashed bg-transparent',
              // Revealed after an answer.
              isCorrect && 'bg-success-tint border-success text-success',
              isWrongPick && 'bg-danger-tint border-danger text-danger',
              revealing &&
                !isCorrect &&
                !isWrongPick &&
                !locked &&
                'bg-surface border-border opacity-60',
              shaking && 'animate-shake motion-reduce:animate-none',
            )}
          >
            {locked ? (
              <LockIcon
                className="absolute top-1.5 right-1.5 size-3 opacity-70"
                aria-hidden="true"
              />
            ) : shortcut ? (
              <span
                className="text-muted absolute top-1 right-1.5 font-mono text-[10px] leading-none"
                aria-hidden="true"
              >
                {shortcutLabel(shortcut)}
              </span>
            ) : null}

            <span className="font-mono text-xl leading-none font-medium">{choice.label}</span>
            {choice.sublabel ? (
              <span className="text-muted text-[11px] leading-none">{choice.sublabel}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
