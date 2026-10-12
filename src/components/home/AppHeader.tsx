import { Avatar } from '@/components/Avatar';
import { Wordmark } from '@/components/Wordmark';
import { FlameIcon } from '@/components/ui/icons';
import type { StreakSummary } from '@/lib/mock/home';

export interface AppHeaderProps {
  displayName: string;
  initials: string;
  streak: StreakSummary;
}

/** Wordmark on the left, streak pill and avatar on the right. */
export function AppHeader({ displayName, initials, streak }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-3">
      <Wordmark />

      <div className="flex items-center gap-2">
        <span
          className="border-border bg-surface inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 py-1"
          // Icon + number alone would read as "12"; spell it out for screen readers.
          aria-label={`${streak.current} day streak, best ${streak.best}`}
        >
          <FlameIcon width={16} height={16} className="text-accent" />
          <span className="font-mono text-sm font-medium" aria-hidden="true">
            {streak.current}
          </span>
        </span>

        {/* size md keeps the link at the 44px minimum touch target */}
        <Avatar initials={initials} label={`${displayName} — open settings`} href="/settings" />
      </div>
    </header>
  );
}
