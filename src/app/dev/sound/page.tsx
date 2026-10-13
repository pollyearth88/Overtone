import type { Metadata } from 'next';

import { SoundLab } from '@/components/dev/SoundLab';

/**
 * A hidden bench for auditioning the Phase 2 engine. Not linked from anywhere
 * in the app, and marked `noindex` — but deliberately left reachable on a
 * deployment, because "does the cello sound right on a real phone" is not a
 * question a desktop dev server can answer.
 */
export const metadata: Metadata = {
  title: 'Sound lab — Overtone',
  robots: { index: false, follow: false },
};

export default function DevSoundPage() {
  return <SoundLab />;
}
