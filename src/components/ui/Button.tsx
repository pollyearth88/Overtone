import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'outline' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width. */
  fullWidth?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-fg border border-primary hover:opacity-90 active:opacity-80',
  outline: 'bg-transparent text-text border border-border hover:bg-track/60 active:bg-track',
  ghost: 'bg-transparent text-primary border border-transparent hover:bg-track/60 active:bg-track',
};

const SIZES: Record<ButtonSize, string> = {
  // min-h-11 == 44px, the spec's minimum touch target
  md: 'min-h-11 px-4 py-2.5 text-[15px]',
  lg: 'min-h-13 px-5 py-3 text-base',
};

/** The project's only button. Always a real <button>. */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'rounded-control inline-flex items-center justify-center gap-2 font-medium transition-[opacity,background-color] duration-150',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
