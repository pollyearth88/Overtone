import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** `onPrimary` sits on a navy card; `accent` is the daily/streak label. */
  tone?: 'default' | 'accent' | 'onPrimary';
  children: ReactNode;
}

/**
 * Pill chip for context: key, instrument, question count.
 * Monospace per the spec's type rules.
 */
export function Chip({ tone = 'default', className, children, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-xs leading-none',
        // `text-text`, not `text-muted`: muted on track is only 4.35:1.
        tone === 'default' && 'bg-track text-text',
        tone === 'accent' && 'bg-accent-strong text-accent-fg',
        tone === 'onPrimary' && 'bg-primary-fg/15 text-primary-fg',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
