'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { PlayIcon, TargetIcon } from '@/components/ui/icons';
import { getDataStore } from '@/lib/data/LocalStore';
import { newSkillProgress } from '@/lib/learning/progress';
import { PRACTICE_QUESTION_COUNT, LEVEL_TEST_QUESTION_COUNT } from '@/lib/learning/mastery';
import { scaleDegreesGenerator } from '@/lib/modes/scaleDegrees';
import { degreeFromItemKey } from '@/lib/modes/scaleDegrees';
import { degreeLabel, isDegree } from '@/lib/theory/degrees';

/** Entry points into a scale-degree session, with whatever is due for review. */
export function PracticeOptions() {
  const [level, setLevel] = useState<number | null>(null);
  const [due, setDue] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const store = getDataStore();
      const progress =
        (await store.getSkillProgress('scaleDegrees')) ?? newSkillProgress('scaleDegrees');
      const dueKeys = await store.getDueItemKeys('scaleDegrees');
      if (cancelled) return;
      setLevel(progress.level);
      setDue(dueKeys);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (level === null) {
    return <p className="text-muted font-mono text-sm">Loading…</p>;
  }

  const dueDegrees = due
    .map(degreeFromItemKey)
    .filter((degree): degree is string => degree !== null && isDegree(degree));

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium">Scale degrees</p>
          <span className="text-muted font-mono text-xs">Lv {level}</span>
        </div>
        <p className="text-muted mt-0.5 text-xs">{scaleDegreesGenerator.levelLabel(level)}</p>

        {dueDegrees.length > 0 ? (
          <div className="mt-3">
            <p className="text-muted font-mono text-[10px] tracking-wide uppercase">
              Due for review
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {dueDegrees.slice(0, 8).map((degree) => (
                <Chip key={degree} className="font-mono">
                  {isDegree(degree) ? degreeLabel(degree) : degree}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          <Link href={`/drill/scale-degrees?level=${level}&kind=practice`}>
            <Button fullWidth size="lg">
              <PlayIcon className="size-4" /> Practice · {PRACTICE_QUESTION_COUNT} questions
            </Button>
          </Link>
          <Link href={`/drill/scale-degrees?level=${level}&kind=test`}>
            <Button fullWidth variant="outline">
              <TargetIcon className="size-4" /> Level test · {LEVEL_TEST_QUESTION_COUNT} questions,
              no feedback
            </Button>
          </Link>
          <Link href={`/listen/scale-degrees?level=${level}`}>
            <Button fullWidth variant="ghost">
              Listen mode
            </Button>
          </Link>
        </div>
      </Card>

      <p className="text-muted text-xs">
        Pick a different level from the{' '}
        <Link href="/learn" className="underline">
          Learn
        </Link>{' '}
        tab — any level can be opened at any time.
      </p>
    </div>
  );
}
