import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Moon, Sun } from 'lucide-react';

import { SearchableCombobox } from '@/components/SearchableCombobox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  usePanelPreferences,
  useUpdatePanelPreferences,
} from '@/hooks/usePanelPreferences';
import i18n from '@/i18n';
import { TIMEZONES } from '@/lib/timezone';
import { cn } from '@/lib/utils';
import type { PanelPreferences } from '@/types/panel-preferences';
import { DEFAULT_PANEL_PREFERENCES } from '@/types/panel-preferences';
import type { Theme } from '@/store/theme.store';
import { useThemeStore } from '@/store/theme.store';
import { useUiStore } from '@/store/ui.store';

const THEME_OPTIONS: {
  value: Theme;
  label: string;
  description: string;
  icon: typeof Sun;
  previewClass: string;
}[] = [
  {
    value: 'system',
    label: 'Sistem',
    description: 'İşletim sistemi temasını takip eder',
    icon: Monitor,
    previewClass: 'bg-gradient-to-br from-slate-100 to-slate-800',
  },
  {
    value: 'light',
    label: 'Açık',
    description: 'Açık arka plan, koyu metin',
    icon: Sun,
    previewClass: 'bg-slate-50 border-slate-200',
  },
  {
    value: 'dark',
    label: 'Koyu',
    description: 'Koyu arka plan, açık metin',
    icon: Moon,
    previewClass: 'bg-slate-900 border-slate-700',
  },
];

function formatCurrencyPreview(format: PanelPreferences['currencyFormat']): string {
  const amount = 1234.56;
  if (format === 'en-US') {
    return `₺${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `₺${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AppearanceTab(): ReactElement {
  const { t } = useTranslation();
  const setTheme = useThemeStore((s) => s.setTheme);
  const setSidebarCollapsed = useUiStore((s) => s.setSidebarCollapsed);

  const prefsQuery = usePanelPreferences();
  const saveMutation = useUpdatePanelPreferences();

  const [draft, setDraft] = useState<PanelPreferences>(DEFAULT_PANEL_PREFERENCES);

  useEffect(() => {
    if (prefsQuery.data) {
      setDraft(prefsQuery.data);
    }
  }, [prefsQuery.data]);

  const timezoneOptions = useMemo(
    () =>
      TIMEZONES.map((tz) => ({
        value: tz.value,
        label: t(tz.labelKey),
      })),
    [t],
  );

  const handleSave = (): void => {
    setTheme(draft.theme);
    void i18n.changeLanguage(draft.language);
    setSidebarCollapsed(draft.sidebarCollapsedDefault);
    saveMutation.mutate(draft);
  };

  if (prefsQuery.isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (prefsQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        Görünüm ayarları yüklenemedi. Sayfayı yenileyip tekrar deneyin.
      </p>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold">{t('settings.appearanceTitle')}</h2>
        <p className="text-sm text-muted-foreground">{t('settings.appearanceHint')}</p>
      </div>

      <div className="space-y-3">
        <Label>Tema</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const selected = draft.theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDraft((prev) => ({ ...prev, theme: opt.value }))}
                className={cn(
                  'rounded-lg border p-3 text-left transition-colors',
                  selected
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-border hover:bg-muted/50',
                )}
              >
                <div
                  className={cn(
                    'mb-3 h-16 rounded-md border p-2',
                    opt.previewClass,
                  )}
                >
                  <div className="h-2 w-8 rounded bg-primary/80" />
                  <div className="mt-2 h-1.5 w-full rounded bg-muted-foreground/30" />
                  <div className="mt-1 h-1.5 w-2/3 rounded bg-muted-foreground/20" />
                </div>
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="font-medium">{opt.label}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{opt.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="panel-language">{t('settings.languageLabel')}</Label>
        <Select
          value={draft.language}
          onValueChange={(lang) =>
            setDraft((prev) => ({
              ...prev,
              language: lang === 'en' ? 'en' : 'tr',
            }))
          }
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

      <div className="space-y-2">
        <Label htmlFor="panel-timezone">{t('settings.timezoneLabel')}</Label>
        <p className="text-sm text-muted-foreground">{t('settings.timezoneHint')}</p>
        <SearchableCombobox
          id="panel-timezone"
          options={timezoneOptions}
          value={draft.timezone}
          onChange={(value) => setDraft((prev) => ({ ...prev, timezone: value }))}
          placeholder="Saat dilimi seçin…"
          searchPlaceholder="Saat dilimi ara…"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="date-format">Tarih formatı</Label>
        <Select
          value={draft.dateFormat}
          onValueChange={(value) =>
            setDraft((prev) => ({
              ...prev,
              dateFormat: value === 'MM/DD/YYYY' ? 'MM/DD/YYYY' : 'DD/MM/YYYY',
            }))
          }
        >
          <SelectTrigger id="date-format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (31/12/2026)</SelectItem>
            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (12/31/2026)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="currency-format">Para birimi gösterimi</Label>
        <Select
          value={draft.currencyFormat}
          onValueChange={(value) =>
            setDraft((prev) => ({
              ...prev,
              currencyFormat: value === 'en-US' ? 'en-US' : 'tr-TR',
            }))
          }
        >
          <SelectTrigger id="currency-format">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tr-TR">{formatCurrencyPreview('tr-TR')}</SelectItem>
            <SelectItem value="en-US">{formatCurrencyPreview('en-US')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="sidebar-collapsed">Sidebar daraltılmış varsayılan</Label>
          <p className="text-sm text-muted-foreground">
            Panele her girişte kenar çubuğu daraltılmış başlasın.
          </p>
        </div>
        <Switch
          id="sidebar-collapsed"
          checked={draft.sidebarCollapsedDefault}
          onCheckedChange={(checked) =>
            setDraft((prev) => ({ ...prev, sidebarCollapsedDefault: checked }))
          }
        />
      </div>

      <Button type="button" onClick={handleSave} disabled={saveMutation.isPending}>
        Ayarları kaydet
      </Button>
    </div>
  );
}
