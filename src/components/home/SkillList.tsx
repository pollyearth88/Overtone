import Link from 'next/link';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ChevronRightIcon, LockIcon } from '@/components/ui/icons';
import type { SkillSummary } from '@/lib/mock/home';

function SkillRow({ skill }: { skill: SkillSummary }) {
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

  if (skill.locked) {
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
        href="/learn"
        className="border-border bg-surface hover:border-primary/40 rounded-card flex min-h-11 items-center gap-3 border p-4 transition-colors duration-150"
      >
        <div className="min-w-0 flex-1">{meta}</div>
        <ChevronRightIcon width={18} height={18} className="text-muted shrink-0" />
      </Link>
    </li>
  );
}

export function SkillList({ skills }: { skills: readonly SkillSummary[] }) {
  return (
    <section aria-labelledby="your-skills">
      <h2 id="your-skills" className="mb-2.5 text-base font-semibold">
        Your skills
      </h2>
      <ul className="flex flex-col gap-2.5">
        {skills.map((skill) => (
          <SkillRow key={skill.mode} skill={skill} />
        ))}
      </ul>
    </section>
  );
}
