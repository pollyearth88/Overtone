'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { ChevronRightIcon, LockIcon } from '@/components/ui/icons';
import { getDataStore } from '@/lib/data/LocalStore';
import { ADAPTIVE_WINDOW, adaptiveReadiness } from '@/lib/learning/adaptive';
import { levelProgress } from '@/lib/learning/mastery';
import { isLevelMastered, newSkillProgress } from '@/lib/learning/progress';
import {
  carriesForwardInto,
  levelChoiceCount,
  levelStarterCount,
  scaleDegreesGenerator,
} from '@/lib/modes/scaleDegrees';
import type { SkillSummary } from '@/lib/mock/home';

export interface SkillListProps {
  /** The modes that are not built yet — still placeholder rows. */
  placeholders: readonly SkillSummary[];
}

function SkillRow({ skill, href }: { skill: SkillSummary; href?: string }) {
  const meta = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{skill.name}</span>
        <span className="text-muted font-mono text-xs whitespace-nowrap">
          {skill.locked ? 'Locked' : `Lv ${skill.level}`}
        </span>
      </div>
      <p className="text-muted mt-0.5 text-xs">{skill.levelLabel}</p>
      <ProgressBar
        className="mt-2.5"
        value={skill.progress}
        label={`${skill.name} level ${skill.level} progress`}
      />
    </>
  );

  if (skill.locked || !href) {
    return (
      <li className="border-border bg-surface rounded-card flex min-h-11 items-center gap-3 border p-4 opacity-60">
        <LockIcon width={18} height={18} className="text-muted shrink-0" />
        <div className="min-w-0 flex-1">{meta}</div>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        className="border-border bg-surface hover:border-primary/40 rounded-card flex min-h-11 items-center gap-3 border p-4 transition-colors duration-150"
      >
        <div className="min-w-0 flex-1">{meta}</div>
        <ChevronRightIcon width={18} height={18} className="text-muted shrink-0" />
      </Link>
    </li>
  );
}

/**
 * The Home screen's skills list.
 *
 * Scale degrees reads real saved progress; the other four modes are still the
 * Phase 1 placeholders until Phase 5 builds them. The list is a client
 * component because the progress lives in IndexedDB, which only exists on the
 * client — so the real row renders its stored state on the second paint.
 */
export function SkillList({ placeholders }: SkillListProps) {
  const [scaleDegrees, setScaleDegrees] = useState<SkillSummary | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const store = getDataStore();
      const progress =
        (await store.getSkillProgress('scaleDegrees')) ?? newSkillProgress('scaleDegrees');

      const recent = await store.getRecentAnswers({
        mode: 'scaleDegrees',
        level: progress.level,
        since: progress.choicesUnlockedAt,
        limit: ADAPTIVE_WINDOW,
      });

      if (cancelled) return;

      const totalChoices = levelChoiceCount(progress.level);
      const starterChoices = levelStarterCount(
        progress.level,
        carriesForwardInto(progress.level, progress.masteredLevels),
      );
      setScaleDegrees({
        mode: 'scaleDegrees',
        name: 'Scale degrees',
        level: progress.level,
        levelLabel: scaleDegreesGenerator.levelLabel(progress.level),
        progress: levelProgress({
          unlockedChoices: progress.unlockedChoices,
          totalChoices,
          starterChoices,
          readiness: adaptiveReadiness({
            answers: [...recent].reverse(),
            unlockedChoices: progress.unlockedChoices,
            totalChoices,
          }),
          mastered: isLevelMastered(progress, progress.level),
        }),
        locked: false,
      });
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section aria-labelledby="your-skills">
      <h2 id="your-skills" className="mb-2.5 text-base font-semibold">
        Your skills
      </h2>
      <ul className="flex flex-col gap-2.5">
        {scaleDegrees ? (
          <SkillRow skill={scaleDegrees} href="/learn" />
        ) : (
          <li
            className="border-border bg-surface rounded-card min-h-20 animate-pulse border p-4 motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        {placeholders.map((skill) => (
          <SkillRow key={skill.mode} skill={skill} />
        ))}
      </ul>
    </section>
  );
}
