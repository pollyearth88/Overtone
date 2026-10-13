'use client';

import { cn } from '@/lib/cn';
import type { AnswerChoice } from '@/lib/modes/types';

export interface DegreeGridProps {
  choices: readonly AnswerChoice[];
  onAnswer: (choiceId: string) => void;
  disabled?: boolean;
  /** Highlighted after an answer: the one that was right. */
  correctId?: string | null;
  /** Highlighted after a wrong answer: the one that was picked. */
  chosenId?: string | null;
}

/**
 * The answer buttons: number on top, solfège underneath.
 *
 * Locked choices are shown rather than hidden — seeing that `6` and `7` are
 * coming is part of what makes the adaptive unlock feel earned — but they are
 * dimmed and genuinely `disabled`, not just visually faded.
 */
export function DegreeGrid({
  choices,
  onAnswer,
  disabled = false,
  correctId = null,
  chosenId = null,
}: DegreeGridProps) {
  const revealing = correctId !== null;

  return (
    <div className="grid grid-cols-4 gap-2">
      {choices.map((choice, index) => {
        const locked = choice.locked ?? false;
        const isCorrect = revealing && choice.id === correctId;
        const isWrongPick = revealing && choice.id === chosenId && chosenId !== correctId;

        return (
          <button
            key={choice.id}
            type="button"
            disabled={disabled || locked}
            onClick={() => onAnswer(choice.id)}
            aria-label={`${choice.label}${choice.sublabel ? `, ${choice.sublabel}` : ''}${
              locked ? ', locked' : ''
            }`}
            // 1-7 on the keyboard map to the first nine buttons; showing the
            // number keeps the shortcut discoverable on desktop.
            data-shortcut={index < 9 ? index + 1 : undefined}
            className={cn(
              'rounded-control flex min-h-16 flex-col items-center justify-center gap-0.5 border transition-colors duration-150',
              'disabled:cursor-not-allowed',
              !revealing &&
                !locked &&
                'bg-surface border-border hover:border-primary/50 active:bg-track',
              locked && 'bg-surface/50 border-border text-muted opacity-50',
              isCorrect && 'bg-success-tint border-success text-success',
              isWrongPick && 'bg-danger-tint border-danger text-danger',
              revealing && !isCorrect && !isWrongPick && 'bg-surface border-border opacity-60',
            )}
          >
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
