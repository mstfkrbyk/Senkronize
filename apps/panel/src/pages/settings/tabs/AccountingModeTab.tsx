import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AlertTriangle, Receipt, Server } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAccountingMode } from '@/hooks/useAccountingMode';
import { api, getApiErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { AccountingMode } from '@/types/auth';
import type { OrganizationDetail } from '@/types/organization';

const MODE_THEMES: Record<
  AccountingMode,
  {
    selectedCard: string;
    selectedIcon: string;
    badge: string;
  }
> = {
  NATIVE: {
    selectedCard: 'border-2 border-emerald-500 shadow-sm ring-2 ring-emerald-500/20',
    selectedIcon: 'border-emerald-400/60 bg-emerald-500/10 text-emerald-700',
    badge: 'border-emerald-400 text-emerald-700',
  },
  EXTERNAL_ERP: {
    selectedCard: 'border-2 border-sky-500 shadow-sm ring-2 ring-sky-500/20',
    selectedIcon: 'border-sky-400/60 bg-sky-500/10 text-sky-700',
    badge: 'border-sky-400 text-sky-700',
  },
};

const MODE_OPTION_DEFS: readonly {
  value: AccountingMode;
  titleKey: 'settings.accountingModeTab.modes.native.title' | 'settings.accountingModeTab.modes.externalErp.title';
  descriptionKey:
    | 'settings.accountingModeTab.modes.native.description'
    | 'settings.accountingModeTab.modes.externalErp.description';
  icon: typeof Receipt;
}[] = [
  {
    value: 'NATIVE',
    titleKey: 'settings.accountingModeTab.modes.native.title',
    descriptionKey: 'settings.accountingModeTab.modes.native.description',
    icon: Receipt,
  },
  {
    value: 'EXTERNAL_ERP',
    titleKey: 'settings.accountingModeTab.modes.externalErp.title',
    descriptionKey: 'settings.accountingModeTab.modes.externalErp.description',
    icon: Server,
  },
];

export function AccountingModeTab(): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setOrg = useAuthStore((s) => s.setOrg);
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const {
    mode: resolvedMode,
    isLoading: modeLoading,
    hasActiveErpConnection,
    activeErpConnectionCount,
  } = useAccountingMode();

  const modeOptions = useMemo(
    () =>
      MODE_OPTION_DEFS.map((opt) => ({
        value: opt.value,
        title: t(opt.titleKey),
        description: t(opt.descriptionKey),
        icon: opt.icon,
      })),
    [t],
  );

  const [selected, setSelected] = useState<AccountingMode>(resolvedMode);

  useEffect(() => {
    setSelected(resolvedMode);
  }, [resolvedMode]);

  const nativeBlocked = selected === 'NATIVE' && hasActiveErpConnection;

  const saveMutation = useMutation({
    mutationFn: async (accountingMode: AccountingMode): Promise<OrganizationDetail> => {
      const { data } = await api.patch<OrganizationDetail>('/organizations/me', {
        accountingMode,
      });
      return data;
    },
    onSuccess: (data) => {
      if (currentOrg) {
        setOrg({
          ...currentOrg,
          accountingMode: data.accountingMode ?? selected,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['erp-connections'] });
      toast.success(t('settings.accountingModeTab.saveSuccess'));
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  if (modeLoading) {
    return (
      <SettingsPageShell
        title={t('settings.accountingModeTab.title')}
        description={t('settings.accountingModeTab.description')}
      >
        <Skeleton className="h-32 w-full" />
      </SettingsPageShell>
    );
  }

  const dirty = selected !== resolvedMode;
  const resolvedTheme = MODE_THEMES[resolvedMode];

  return (
    <SettingsPageShell
      title={t('settings.accountingModeTab.title')}
      description={t('settings.accountingModeTab.description')}
    >
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
            <Badge variant="outline" className={resolvedTheme.badge}>
              {resolvedMode === 'NATIVE'
                ? t('settings.accountingModeTab.modes.native.title')
                : t('settings.accountingModeTab.modes.externalErp.title')}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {t('settings.accountingModeTab.currentModeLabel')}
            </span>
          </div>

          <div
            className="grid gap-3"
            role="radiogroup"
            aria-label={t('settings.accountingModeTab.radioGroupAriaLabel')}
          >
            {modeOptions.map((opt) => {
              const isSelected = selected === opt.value;
              const theme = MODE_THEMES[opt.value];
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={saveMutation.isPending}
                  onClick={() => setSelected(opt.value)}
                  className={cn(
                    'rounded-lg border bg-card p-4 text-left transition-all',
                    isSelected ? theme.selectedCard : 'border-border hover:border-muted-foreground/30',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                        isSelected
                          ? theme.selectedIcon
                          : 'border-border bg-muted/50 text-muted-foreground',
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{opt.title}</p>
                      <p className="text-sm text-muted-foreground">{opt.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {dirty ? (
            <Alert className="border-amber-200 bg-amber-50/80 text-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden />
              <AlertTitle className="text-amber-950">
                {t('settings.accountingModeTab.switchWarning.title')}
              </AlertTitle>
              <AlertDescription className="text-amber-900/90">
                {t('settings.accountingModeTab.switchWarning.description')}
              </AlertDescription>
            </Alert>
          ) : null}

          {nativeBlocked ? (
            <Alert variant="destructive">
              <AlertTitle>{t('settings.accountingModeTab.nativeBlocked.title')}</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  {t('settings.accountingModeTab.nativeBlocked.description', {
                    count: activeErpConnectionCount,
                  })}
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/connections?tab=erp">
                    {t('settings.accountingModeTab.nativeBlocked.connectionsCta')}
                  </Link>
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <Button
            type="button"
            disabled={!dirty || nativeBlocked || saveMutation.isPending}
            onClick={() => saveMutation.mutate(selected)}
          >
            {saveMutation.isPending
              ? t('settings.accountingModeTab.saving')
              : t('settings.accountingModeTab.save')}
          </Button>
        </CardContent>
      </Card>
    </SettingsPageShell>
  );
}
