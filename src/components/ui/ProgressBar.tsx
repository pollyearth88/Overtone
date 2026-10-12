import { cn } from '@/lib/cn';

export interface ProgressBarProps {
  /** 0-100. */
  value: number;
  /** Accessible name, e.g. "Scale degrees progress". */
  label: string;
  tone?: 'primary' | 'accent' | 'onPrimary';
  className?: string;
}

const FILL: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  onPrimary: 'bg-primary-fg',
};

const TRACK: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  primary: 'bg-track',
  accent: 'bg-track',
  onPrimary: 'bg-primary-fg/25',
};

export function ProgressBar({ value, label, tone = 'primary', className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-2 w-full overflow-hidden rounded-full', TRACK[tone], className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', FILL[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
