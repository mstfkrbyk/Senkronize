import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import i18n from '@/i18n';
import { cn } from '@/lib/utils';
import type { Theme } from '@/store/theme.store';
import { useThemeStore } from '@/store/theme.store';

const THEME_OPTIONS: { value: Theme; labelKey: string; descKey: string }[] = [
  { value: 'light', labelKey: 'theme.light', descKey: 'theme.lightDesc' },
  { value: 'dark', labelKey: 'theme.dark', descKey: 'theme.darkDesc' },
  { value: 'system', labelKey: 'theme.system', descKey: 'theme.systemDesc' },
];

export function AppearanceTab(): ReactElement {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const resolvedLang = (i18n.resolvedLanguage ?? 'tr').split('-')[0] ?? 'tr';
  const languageValue = resolvedLang === 'en' ? 'en' : 'tr';

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h2 className="text-lg font-semibold">{t('settings.appearanceTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('settings.appearanceHint')}</p>
      </div>
      <fieldset className="space-y-3" role="radiogroup" aria-label={t('settings.themeLegend')}>
        <legend className="sr-only">{t('settings.themeLegend')}</legend>
        {THEME_OPTIONS.map((opt) => (
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
              <span className="text-base font-medium leading-none">{t(opt.labelKey)}</span>
              <span className="block text-sm text-muted-foreground">{t(opt.descKey)}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="panel-language">{t('settings.languageLabel')}</Label>
        <Select
          value={languageValue}
          onValueChange={(lang) => {
            void i18n.changeLanguage(lang);
          }}
        >
          <SelectTrigger id="panel-language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tr">🇹🇷 Türkçe</SelectItem>
            <SelectItem value="en">🇬🇧 English</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
