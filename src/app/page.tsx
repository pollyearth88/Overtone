import { AppHeader } from '@/components/home/AppHeader';
import { DailyChallengeCard } from '@/components/home/DailyChallengeCard';
import { FriendChallengeRow } from '@/components/home/FriendChallengeRow';
import { SkillList } from '@/components/home/SkillList';
import { greetingFor, mockHome } from '@/lib/mock/home';

// Rendered per request so the greeting is not baked in at build time.
// Phase 6 replaces this with the user's own time zone.
export const dynamic = 'force-dynamic';

// Phase 1 reads placeholder data; Phase 3 swaps in the real DataStore.
export default function HomePage() {
  const { displayName, initials, streak, daily, skills, friendChallenge } = mockHome;

  return (
    <>
      <AppHeader displayName={displayName} initials={initials} streak={streak} />

      <main id="main" className="mt-6 flex flex-col gap-6">
        <div>
          <p className="text-muted text-sm">{greetingFor(new Date())}</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
            Ready to train, {displayName}?
          </h1>
        </div>

        <DailyChallengeCard daily={daily} />

        <SkillList skills={skills} />

        <section aria-labelledby="head-to-head">
          <h2 id="head-to-head" className="mb-2.5 text-base font-semibold">
            Head to head
          </h2>
          <FriendChallengeRow challenge={friendChallenge} />
        </section>
      </main>
    </>
  );
}
