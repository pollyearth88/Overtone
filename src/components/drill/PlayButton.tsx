'use client';

import { PlayIcon } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export interface PlayButtonProps {
  onClick: () => void;
  isPlaying?: boolean;
  disabled?: boolean;
  /** Accessible name — differs between "play the note" and "play it again". */
  label: string;
}

/**
 * The big round button in the middle of the drill. Replays the target note.
 *
 * The pulse while playing is the only motion in the drill, and it is behind
 * `motion-reduce` because an animation that tracks audio is exactly the kind a
 * motion-sensitive user wants off.
 */
export function PlayButton({
  onClick,
  isPlaying = false,
  disabled = false,
  label,
}: PlayButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'bg-primary text-primary-fg relative flex size-24 items-center justify-center rounded-full',
        'transition-[transform,opacity] duration-150 active:scale-95',
        'disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {isPlaying ? (
        <span
          aria-hidden="true"
          className="bg-primary/30 absolute inset-0 animate-ping rounded-full motion-reduce:animate-none"
        />
      ) : null}
      <PlayIcon className="relative size-10" aria-hidden="true" />
    </button>
  );
}
