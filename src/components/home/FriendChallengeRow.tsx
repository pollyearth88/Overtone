import Link from 'next/link';
import { Avatar } from '@/components/Avatar';
import { SwordsIcon } from '@/components/ui/icons';
import type { FriendChallengeSummary } from '@/lib/mock/home';

/** Async head-to-head prompt: a friend's set waiting to be beaten. */
export function FriendChallengeRow({ challenge }: { challenge: FriendChallengeSummary }) {
  return (
    <Link
      href="/play"
      className="border-border bg-surface hover:border-primary/40 rounded-card flex min-h-11 items-center gap-3 border p-4 transition-colors duration-150"
    >
      <Avatar
        initials={challenge.friendInitials}
        label={`${challenge.friendName}'s avatar`}
        size="sm"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{challenge.friendName} challenged you</span>
        <span className="text-muted block text-xs">
          {challenge.modeName} · <span className="font-mono">{challenge.scoreToBeat}</span> to beat
        </span>
      </span>
      <span className="text-primary inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap">
        <SwordsIcon width={18} height={18} />
        Play
      </span>
    </Link>
  );
}
