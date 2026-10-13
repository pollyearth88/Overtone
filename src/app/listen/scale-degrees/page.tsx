import type { Metadata } from 'next';

import { ListenMode } from '@/components/drill/ListenMode';
import { parseLevel } from '@/lib/modes/scaleDegrees';

export const metadata: Metadata = {
  title: 'Listen — Overtone',
};

interface PageProps {
  searchParams: Promise<{ level?: string }>;
}

export default async function ListenPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <ListenMode level={parseLevel(params.level)} />;
}
