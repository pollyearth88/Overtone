import { PracticeOptions } from '@/components/learn/PracticeOptions';

export default function PracticePage() {
  return (
    <main id="main" className="pt-2">
      <h1 className="text-2xl font-semibold tracking-tight">Practice</h1>
      <p className="text-muted mt-1 text-sm">
        A 20-question session, about five minutes. Mixed review across every mode arrives in Phase
        5.
      </p>

      <div className="mt-5">
        <PracticeOptions />
      </div>
    </main>
  );
}
