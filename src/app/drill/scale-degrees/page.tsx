import type { Metadata } from 'next';

import { ScaleDegreeDrill } from '@/components/drill/ScaleDegreeDrill';
import { FocusLayer } from '@/components/FocusLayer';
import { parseLevel } from '@/lib/modes/scaleDegrees';

export const metadata: Metadata = {
  title: 'Scale degrees — Overtone',
};

interface PageProps {
  searchParams: Promise<{ level?: string; kind?: string }>;
}

export default async function ScaleDegreeDrillPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const level = parseLevel(params.level);
  const kind = params.kind === 'test' ? 'test' : 'practice';

  return (
    <FocusLayer>
      <ScaleDegreeDrill level={level} kind={kind} />
    </FocusLayer>
  );
}
