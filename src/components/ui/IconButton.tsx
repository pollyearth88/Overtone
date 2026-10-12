import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required: icon-only controls need an accessible name. */
  label: string;
  icon: ReactNode;
  variant?: 'outline' | 'ghost' | 'primary';
}

const VARIANTS: Record<NonNullable<IconButtonProps['variant']>, string> = {
  outline: 'bg-surface text-text border-border hover:bg-track/60',
  ghost: 'bg-transparent text-text border-transparent hover:bg-track/60',
  primary: 'bg-primary text-primary-fg border-primary hover:opacity-90',
};

/** 44x44 minimum, always labelled. */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
