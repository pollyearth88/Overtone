import type { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

export interface PlaceholderPageProps {
  title: string;
  /** One line on what this screen will do. */
  description: string;
  /** Which roadmap phase fills it in. */
  phase: string;
  children?: ReactNode;
}

/** Shell for the tabs that get built in later phases. */
export function PlaceholderPage({ title, description, phase, children }: PlaceholderPageProps) {
  return (
    <main id="main" className="pt-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted mt-1 text-sm">{description}</p>

      {children ?? (
        <Card className="mt-5">
          <p className="text-muted font-mono text-xs tracking-wide uppercase">Coming in {phase}</p>
          <p className="mt-2 text-sm">Nothing here yet — this screen is still groundwork.</p>
        </Card>
      )}
    </main>
  );
}
