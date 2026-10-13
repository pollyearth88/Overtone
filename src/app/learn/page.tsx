import { Card } from '@/components/ui/Card';
import { LevelLadder } from '@/components/learn/LevelLadder';
import { LockIcon } from '@/components/ui/icons';

/** The other four modes arrive in Phase 5; naming them keeps the ladder honest. */
const COMING_SOON = [
  { name: 'Intervals', detail: 'P5 vs P8 → all within an octave → falling → harmonic' },
  { name: 'Chords', detail: 'major vs minor → + dim, aug → 7ths → inversions' },
  { name: 'Progressions', detail: 'I–IV–V → + vi → + ii → pop patterns' },
  { name: 'Melodic dictation', detail: '3 notes by step → skips → two octaves → rhythm' },
];

export default function LearnPage() {
  return (
    <main id="main" className="pt-2">
      <h1 className="text-2xl font-semibold tracking-tight">Learn</h1>
      <p className="text-muted mt-1 text-sm">
        Every skill and its level ladder — locked, unlocked and mastered.
      </p>

      <div className="mt-5">
        <LevelLadder />
      </div>

      <section aria-labelledby="later" className="mt-7">
        <h2 id="later" className="mb-2.5 text-base font-semibold">
          Coming in Phase 5
        </h2>
        <ul className="flex flex-col gap-2">
          {COMING_SOON.map((mode) => (
            <li key={mode.name}>
              <Card className="flex items-center gap-3 opacity-60">
                <LockIcon className="text-muted size-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="font-medium">{mode.name}</p>
                  <p className="text-muted text-xs">{mode.detail}</p>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
