'use client';

import { useTheme } from 'next-themes';
import { cn } from '@/lib/cn';
import { useIsHydrated } from '@/lib/hooks/useIsHydrated';

const OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

/**
 * Manual override for the theme. Defaults to following the OS setting.
 * The stored choice lives in localStorage, so the selected state is only known
 * after hydration — before that no option reads as checked.
 */
export function ThemeSetting() {
  const { theme, setTheme } = useTheme();
  const hydrated = useIsHydrated();

  return (
    <fieldset className="border-border bg-surface rounded-card border p-4">
      <legend className="px-1 text-sm font-medium">Theme</legend>
      <p className="text-muted mt-1 text-xs">
        System follows your device&apos;s light or dark setting.
      </p>

      <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Theme">
        {OPTIONS.map((option) => {
          const selected = hydrated && theme === option.value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(option.value)}
              className={cn(
                'rounded-control min-h-11 flex-1 border px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                selected
                  ? 'bg-primary text-primary-fg border-primary'
                  : 'border-border text-text hover:bg-track/60',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
