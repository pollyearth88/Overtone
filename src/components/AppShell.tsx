import type { ReactNode } from 'react';
import { TabBar } from '@/components/ui/TabBar';

/**
 * Mobile-first app column. Designed at 390px, centred at 480px max on desktop.
 * Bottom padding clears the fixed tab bar.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <div className="mx-auto w-full max-w-[480px] px-4 pt-3 pb-28">{children}</div>
      <TabBar />
    </div>
  );
}
