'use client';

import { IconButton } from '@/components/ui/IconButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { FlameIcon, XIcon } from '@/components/ui/icons';

export interface DrillHeaderProps {
  /** 1-based question number. */
  questionNumber: number;
  questionCount: number;
  combo: number;
  onClose: () => void;
}

export function DrillHeader({ questionNumber, questionCount, combo, onClose }: DrillHeaderProps) {
  const answered = Math.max(0, questionNumber - 1);

  return (
    <div className="flex items-center gap-3">
      <IconButton
        label="End session"
        icon={<XIcon className="size-5" />}
        onClick={onClose}
        variant="ghost"
      />

      <ProgressBar
        className="flex-1"
        value={(answered / Math.max(1, questionCount)) * 100}
        label={`Question ${questionNumber} of ${questionCount}`}
      />

      {/* Combo earns its place on screen only once it means something. */}
      <div className="flex min-w-11 justify-end">
        {combo >= 2 ? (
          <span
            className="text-accent-strong flex items-center gap-1 font-mono text-sm font-medium"
            aria-label={`Combo ${combo}`}
          >
            <FlameIcon className="size-4" aria-hidden="true" />
            {combo}
          </span>
        ) : null}
      </div>
    </div>
  );
}
