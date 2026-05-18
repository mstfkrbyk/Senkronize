import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';
import type { Theme } from '@/store/theme.store';
import { useThemeStore } from '@/store/theme.store';

const OPTIONS: { value: Theme; label: string; description: string }[] = [
  { value: 'light', label: 'Açık', description: 'Her zaman açık tema.' },
  { value: 'dark', label: 'Koyu', description: 'Her zaman koyu tema.' },
  { value: 'system', label: 'Sistem', description: 'İşletim sistemi tercihini kullan.' },
];

export function AppearanceTab(): ReactElement {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="max-w-lg space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Görünüm</h2>
        <p className="text-sm text-muted-foreground">
          Panel temasını seçin. Tercihiniz bu tarayıcıda saklanır.
        </p>
      </div>
      <fieldset className="space-y-3" role="radiogroup" aria-label="Tema">
        <legend className="sr-only">Tema seçimi</legend>
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
              theme === opt.value
                ? 'border-primary bg-accent/30'
                : 'border-border hover:bg-muted/50',
            )}
          >
            <input
              type="radio"
              name="panel-theme"
              value={opt.value}
              checked={theme === opt.value}
              onChange={() => setTheme(opt.value)}
              className="mt-1 size-4 accent-primary"
            />
            <span className="min-w-0 flex-1 space-y-1">
              <span className="text-base font-medium leading-none">{opt.label}</span>
              <span className="block text-sm text-muted-foreground">{opt.description}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
