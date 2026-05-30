import type { ReactElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  PRODUCT_MATCH_KEY_OPTIONS,
  type OrganizationSettingsMatchKey,
  type ProductMatchKey,
} from '@/lib/product-match-key';
import { cn } from '@/lib/utils';

export function ProductMatchingSettingsTab(): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['organizations', 'settings'],
    queryFn: async (): Promise<OrganizationSettingsMatchKey> => {
      const { data } = await api.get<OrganizationSettingsMatchKey>('/organizations/settings');
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (productMatchKey: ProductMatchKey) => {
      const { data } = await api.patch<OrganizationSettingsMatchKey>(
        '/organizations/settings',
        { productMatchKey },
      );
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['organizations', 'settings'] });
      toast.success(t('productMatching.matchKey.saved'));
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const currentKey = settingsQuery.data?.productMatchKey ?? null;

  return (
    <SettingsPageShell
      title={t('settings.productMatching.title')}
      description={t('settings.productMatching.subtitle')}
      maxWidth="max-w-3xl"
    >
      {settingsQuery.isError ? (
        <QueryErrorAlert error={settingsQuery.error} onRetry={() => settingsQuery.refetch()} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('productMatching.matchKey.title')}</CardTitle>
          <CardDescription>{t('productMatching.matchKey.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {settingsQuery.isLoading ? (
            <Skeleton className="h-24 w-full max-w-md" />
          ) : (
            <>
              <p className="text-muted-foreground text-sm">
                {t('productMatching.matchKey.hierarchy')}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                {PRODUCT_MATCH_KEY_OPTIONS.map((option) => {
                  const selected = currentKey === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={saveMutation.isPending}
                      className={cn(
                        'rounded-lg border px-4 py-4 text-left transition-colors',
                        selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:border-primary/40',
                      )}
                      onClick={() => {
                        saveMutation.mutate(option);
                      }}
                    >
                      <p className="font-medium">
                        {t(`productMatching.matchKey.options.${option}`)}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {t(`productMatching.matchKey.hint.${option}`)}
                      </p>
                    </button>
                  );
                })}
              </div>
              {!currentKey ? (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  {t('productMatching.matchKey.hint.notConfigured')}
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.productMatching.overridesTitle')}</CardTitle>
          <CardDescription>{t('settings.productMatching.overridesDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t('settings.productMatching.overridePlatform')}</p>
          <p>{t('settings.productMatching.overrideProduct')}</p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/connections">{t('settings.productMatching.connectionsLink')}</Link>
          </Button>
        </CardContent>
      </Card>
    </SettingsPageShell>
  );
}
