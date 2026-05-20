import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import i18n from '@/i18n';
import {
  getStoredTimezone,
  setStoredTimezone,
  TIMEZONES,
} from '@/lib/timezone';
import { cn } from '@/lib/utils';
import type { Theme } from '@/store/theme.store';
import { useThemeStore } from '@/store/theme.store';

const THEME_OPTIONS: { value: Theme; labelKey: string; descKey: string }[] = [
  { value: 'light', labelKey: 'theme.light', descKey: 'theme.lightDesc' },
  { value: 'dark', labelKey: 'theme.dark', descKey: 'theme.darkDesc' },
  { value: 'system', labelKey: 'theme.system', descKey: 'theme.systemDesc' },
];

const LANGUAGE_FADE_MS = 180;

export function AppearanceTab(): ReactElement {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [contentVisible, setContentVisible] = useState(true);
  const [timezone, setTimezone] = useState(() => getStoredTimezone());

  const resolvedLang = (i18n.resolvedLanguage ?? 'tr').split('-')[0] ?? 'tr';
  const languageValue = resolvedLang === 'en' ? 'en' : 'tr';

  const handleLanguageChange = useCallback(
    (lang: string): void => {
      if (lang === languageValue) {
        return;
      }
      setContentVisible(false);
      window.setTimeout(() => {
        void i18n.changeLanguage(lang).then(() => {
          setContentVisible(true);
          toast.success(i18n.t('settings.languageChanged'));
        });
      }, LANGUAGE_FADE_MS);
    },
    [languageValue],
  );

  const handleTimezoneChange = useCallback((value: string): void => {
    setTimezone(value);
    setStoredTimezone(value);
  }, []);

  return (
    <div
      className={cn(
        'max-w-lg space-y-8 transition-opacity duration-200 ease-in-out',
        contentVisible ? 'opacity-100' : 'opacity-0',
      )}
    >
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
        <Select value={languageValue} onValueChange={handleLanguageChange}>
          <SelectTrigger id="panel-language">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tr">🇹🇷 Türkçe</SelectItem>
            <SelectItem value="en">🇬🇧 English</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="panel-timezone">{t('settings.timezoneLabel')}</Label>
        <p className="text-sm text-muted-foreground">{t('settings.timezoneHint')}</p>
        <Select value={timezone} onValueChange={handleTimezoneChange}>
          <SelectTrigger id="panel-timezone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz.value} value={tz.value}>
                {t(tz.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
