import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface StatPillProps {
  /** Short caption, e.g. "Accuracy". */
  label: string;
  /** The number itself, e.g. "87%". Rendered in JetBrains Mono. */
  value: string;
  icon?: ReactNode;
  tone?: 'default' | 'onPrimary';
  className?: string;
}

/** A labelled stat readout. Used in the header, cards and the stats screen. */
export function StatPill({ label, value, icon, tone = 'default', className }: StatPillProps) {
  return (
    <div
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-1.5',
        tone === 'default' && 'bg-surface border-border',
        tone === 'onPrimary' && 'bg-primary-fg/15 border-transparent',
        className,
      )}
    >
      {icon ? (
        <span
          className={cn('shrink-0', tone === 'onPrimary' ? 'text-primary-fg' : 'text-accent')}
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
      <span className="flex flex-col leading-tight">
        <span
          className={cn(
            'font-mono text-sm font-medium',
            tone === 'onPrimary' ? 'text-primary-fg' : 'text-text',
          )}
        >
          {value}
        </span>
        <span
          className={cn(
            'text-[10px] tracking-wide uppercase',
            tone === 'onPrimary' ? 'text-primary-fg/80' : 'text-muted',
          )}
        >
          {label}
        </span>
      </span>
    </div>
  );
}
