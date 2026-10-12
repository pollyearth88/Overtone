'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import { BookIcon, ChartIcon, TargetIcon, TrophyIcon, type IconProps } from './icons';

interface Tab {
  href: string;
  label: string;
  Icon: (props: IconProps) => React.JSX.Element;
}

const TABS: readonly Tab[] = [
  { href: '/learn', label: 'Learn', Icon: BookIcon },
  { href: '/practice', label: 'Practice', Icon: TargetIcon },
  { href: '/play', label: 'Play', Icon: TrophyIcon },
  { href: '/stats', label: 'Stats', Icon: ChartIcon },
];

/**
 * Bottom tab bar. Fixed to the viewport but constrained to the app column so
 * it stays under the 480px shell on desktop.
 */
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="bg-surface/95 border-border fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur-sm"
    >
      <ul className="mx-auto flex w-full max-w-[480px] items-stretch pb-[env(safe-area-inset-bottom)]">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors duration-150',
                  active ? 'text-primary' : 'text-muted hover:text-text',
                )}
              >
                <Icon width={22} height={22} strokeWidth={active ? 2.1 : 1.75} />
                <span className={cn('text-[11px] leading-none', active && 'font-medium')}>
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
