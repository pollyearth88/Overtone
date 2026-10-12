import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { CheckIcon, ClockIcon, PlayIcon } from '@/components/ui/icons';
import type { DailyChallengeSummary } from '@/lib/mock/home';

/** The hero card: today's shared set, same questions for everyone. */
export function DailyChallengeCard({ daily }: { daily: DailyChallengeSummary }) {
  return (
    <Card tone="primary" className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Chip tone="accent" className="uppercase">
            Daily challenge
          </Chip>
          <h2 className="mt-3 text-xl leading-snug font-semibold">
            {daily.questionCount} questions · {daily.modeName}
          </h2>
          <p className="text-primary-fg/80 mt-1 text-sm">Same set for everyone today</p>
        </div>

        <span className="text-primary-fg/80 inline-flex items-center gap-1.5 font-mono text-xs whitespace-nowrap">
          <ClockIcon width={14} height={14} />
          {daily.resetsIn}
        </span>
      </div>

      {daily.completed ? (
        <p className="bg-primary-fg/15 rounded-control mt-4 inline-flex min-h-11 items-center gap-2 px-4 py-2.5 text-sm font-medium">
          <CheckIcon width={18} height={18} />
          Played today — streak safe
        </p>
      ) : (
        <Link
          href="/play"
          className="bg-primary-fg text-primary rounded-control mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 px-5 py-3 font-medium transition-opacity duration-150 hover:opacity-90"
        >
          <PlayIcon width={20} height={20} />
          Play today&apos;s challenge
        </Link>
      )}
    </Card>
  );
}
