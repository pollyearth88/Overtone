import { Card } from '@/components/ui/Card';
import { ThemeSetting } from '@/components/settings/ThemeSetting';

export default function SettingsPage() {
  return (
    <main id="main" className="pt-2">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="text-muted mt-1 text-sm">Appearance now; account and drills come later.</p>

      <div className="mt-5 flex flex-col gap-4">
        <ThemeSetting />

        <Card>
          <p className="text-muted font-mono text-xs tracking-wide uppercase">Coming in Phase 4</p>
          <p className="mt-2 text-sm">
            Account, sign out, auto-advance, instruments allowed in drills, and delete account.
          </p>
        </Card>
      </div>
    </main>
  );
}
