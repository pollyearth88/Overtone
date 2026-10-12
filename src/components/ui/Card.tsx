import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Navy fill for the hero card (Daily Challenge). */
  tone?: 'surface' | 'primary';
  children: ReactNode;
}

export function Card({ tone = 'surface', className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border p-4',
        tone === 'surface' && 'bg-surface border-border',
        tone === 'primary' && 'bg-primary text-primary-fg border-primary',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
