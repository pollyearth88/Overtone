import { AppHeader } from '@/components/home/AppHeader';
import { DailyChallengeCard } from '@/components/home/DailyChallengeCard';
import { FriendChallengeRow } from '@/components/home/FriendChallengeRow';
import { SkillList } from '@/components/home/SkillList';
import { greetingFor, mockHome } from '@/lib/mock/home';

// Rendered per request so the greeting is not baked in at build time.
// Phase 6 replaces this with the user's own time zone.
export const dynamic = 'force-dynamic';

// Scale degrees now reads real progress from the DataStore (inside SkillList,
// which is a client component because IndexedDB is client-only). The streak,
// daily challenge and friend challenge are still mock — Phase 6 and 7.
export default function HomePage() {
  const { displayName, initials, streak, daily, skills, friendChallenge } = mockHome;
  const placeholders = skills.filter((skill) => skill.mode !== 'scaleDegrees');

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

        <SkillList placeholders={placeholders} />

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
