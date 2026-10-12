import Link from 'next/link';
import { cn } from '@/lib/cn';

export interface AvatarProps {
  initials: string;
  /** Accessible name, e.g. "Micah — open settings". */
  label: string;
  /** When set, the avatar is a link (header); otherwise a plain badge. */
  href?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZES = {
  sm: 'size-9 text-xs',
  md: 'size-11 text-sm',
} as const;

/** Initials avatar placeholder until real profile images exist. */
export function Avatar({ initials, label, href, size = 'md', className }: AvatarProps) {
  const base = cn(
    'inline-flex shrink-0 items-center justify-center rounded-full border font-mono font-medium',
    'bg-track text-text border-border',
    SIZES[size],
    className,
  );

  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={base}>
        <span aria-hidden="true">{initials}</span>
      </Link>
    );
  }

  return (
    <span className={base} role="img" aria-label={label}>
      <span aria-hidden="true">{initials}</span>
    </span>
  );
}
