import type { ReactNode } from 'react';

/**
 * Covers the app shell — including the tab bar — for activities that want the
 * whole screen.
 *
 * A drill is a modal activity: it has its own close button, and leaving it
 * halfway by tapping a tab would silently abandon a session. Rather than
 * restructuring Phase 1's single root layout into route groups, this paints over
 * it; the tab bar is still in the DOM but no longer reachable, which is the
 * intent either way.
 *
 * Phase 8's desktop layout is the point to revisit this properly.
 */
export function FocusLayer({ children }: { children: ReactNode }) {
  return (
    <div className="bg-bg fixed inset-0 z-40 overflow-y-auto">
      <div className="mx-auto w-full max-w-[480px] px-4 pt-3 pb-6">{children}</div>
    </div>
  );
}
