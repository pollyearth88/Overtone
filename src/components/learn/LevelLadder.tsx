'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { CheckIcon, LockIcon, PlayIcon } from '@/components/ui/icons';
import { getDataStore } from '@/lib/data/LocalStore';
import type { SkillProgress } from '@/lib/data/types';
import { adaptiveReadiness, ADAPTIVE_WINDOW } from '@/lib/learning/adaptive';
import { levelProgress } from '@/lib/learning/mastery';
import { isLevelMastered, isLevelUnlocked, newSkillProgress } from '@/lib/learning/progress';
import { SCALE_DEGREE_LEVELS, levelChoiceCount } from '@/lib/modes/scaleDegrees';
import { cn } from '@/lib/cn';

type LevelState = 'mastered' | 'current' | 'unlocked' | 'locked';

function levelState(progress: SkillProgress, level: number): LevelState {
  if (isLevelMastered(progress, level)) return 'mastered';
  if (level === progress.level) return 'current';
  return isLevelUnlocked(progress, level) ? 'unlocked' : 'locked';
}

/**
 * The scale-degree ladder.
 *
 * Every level is openable regardless of state — the spec is explicit that "any
 * level can be opened manually". The lock icon is information ("you have not
 * passed the test below this"), not a gate; the only thing a test actually
 * changes is which level the app *suggests*.
 */
export function LevelLadder() {
  const [progress, setProgress] = useState<SkillProgress | null>(null);
  const [readiness, setReadiness] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const store = getDataStore();
      const stored =
        (await store.getSkillProgress('scaleDegrees')) ?? newSkillProgress('scaleDegrees');

      const recent = await store.getRecentAnswers({
        mode: 'scaleDegrees',
        level: stored.level,
        since: stored.choicesUnlockedAt,
        limit: ADAPTIVE_WINDOW,
      });

      if (cancelled) return;
      setProgress(stored);
      setReadiness(
        adaptiveReadiness({
          answers: [...recent].reverse(),
          unlockedChoices: stored.unlockedChoices,
          totalChoices: levelChoiceCount(stored.level),
        }),
      );
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !progress) {
    return <p className="text-muted font-mono text-sm">Loading progress…</p>;
  }

  const current = progress.level;
  const totalChoices = levelChoiceCount(current);

  return (
    <div className="flex flex-col gap-4">
      <Card tone="primary">
        <p className="text-primary-fg/80 font-mono text-xs tracking-wide uppercase">
          Scale degrees
        </p>
        <p className="mt-1 text-lg font-semibold">Level {current}</p>
        <p className="text-primary-fg/80 mt-0.5 text-sm">
          {progress.unlockedChoices} of {totalChoices} answers unlocked
        </p>
        <ProgressBar
          className="mt-3"
          tone="onPrimary"
          value={levelProgress({
            unlockedChoices: progress.unlockedChoices,
            totalChoices,
            readiness,
            mastered: isLevelMastered(progress, current),
          })}
          label={`Level ${current} progress`}
        />

        <div className="mt-4 flex flex-col gap-2">
          <Link href={`/drill/scale-degrees?level=${current}&kind=practice`}>
            <Button
              fullWidth
              size="lg"
              variant="outline"
              className="bg-primary-fg text-primary border-primary-fg"
            >
              <PlayIcon className="size-4" /> Practice level {current}
            </Button>
          </Link>
          <div className="flex gap-2">
            <Link href={`/drill/scale-degrees?level=${current}&kind=test`} className="flex-1">
              <Button fullWidth variant="ghost" className="text-primary-fg hover:bg-primary-fg/15">
                Level test
              </Button>
            </Link>
            <Link href={`/listen/scale-degrees?level=${current}`} className="flex-1">
              <Button fullWidth variant="ghost" className="text-primary-fg hover:bg-primary-fg/15">
                Listen
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      <section aria-labelledby="ladder">
        <h2 id="ladder" className="mb-2.5 text-base font-semibold">
          All levels
        </h2>
        <ul className="flex flex-col gap-2">
          {SCALE_DEGREE_LEVELS.map((spec) => {
            const state = levelState(progress, spec.level);
            return (
              <li key={spec.level}>
                <Link
                  href={`/drill/scale-degrees?level=${spec.level}&kind=practice`}
                  className={cn(
                    'rounded-card flex min-h-11 items-center gap-3 border p-3.5 transition-colors duration-150',
                    state === 'current'
                      ? 'border-primary bg-surface'
                      : 'border-border bg-surface hover:border-primary/40',
                    state === 'locked' && 'opacity-70',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-sm',
                      state === 'mastered' && 'bg-success-tint text-success',
                      state === 'current' && 'bg-primary text-primary-fg',
                      state === 'unlocked' && 'bg-track text-text',
                      state === 'locked' && 'bg-track text-muted',
                    )}
                    aria-hidden="true"
                  >
                    {state === 'mastered' ? <CheckIcon className="size-4" /> : spec.level}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{spec.label}</span>
                    <span className="text-muted block text-xs">
                      {spec.degrees.length} degrees ·{' '}
                      {spec.keys[0]?.mode === 'minor' ? 'minor keys' : 'major keys'}
                      {spec.octaveSpan === 2 ? ' · two octaves' : ''}
                      {spec.replayCadence ? '' : ' · no cadence replay'}
                    </span>
                  </span>

                  {state === 'mastered' ? (
                    <Chip className="bg-success-tint text-success shrink-0">mastered</Chip>
                  ) : state === 'current' ? (
                    <Chip tone="accent" className="shrink-0">
                      current
                    </Chip>
                  ) : state === 'locked' ? (
                    <LockIcon
                      className="text-muted size-4 shrink-0"
                      aria-label="Not yet unlocked"
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="text-muted mt-2.5 text-xs">
          Any level can be opened at any time. Passing a level test at 90% unlocks the next one and
          marks this one mastered.
        </p>
      </section>
    </div>
  );
}
