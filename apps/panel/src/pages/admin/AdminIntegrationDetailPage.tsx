import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api, getApiErrorMessage } from '@/lib/api';
import { AdminPageHeader } from '@/pages/admin/AdminPageHeader';
import {
  AdminBizimHesapRateLimitTools,
  AdminPlatformActivityLog,
} from '@/components/admin/AdminPlatformActivityLog';
import {
  detailToFormValues,
  formToUpdatePayload,
  type IntegrationFormValues,
} from '@/pages/admin/admin-integration.utils';
import type { AdminIntegrationDetail } from '@/types/admin';

const SYNC_FREQUENCY_OPTIONS = [
  { value: 'REALTIME', label: 'Anlık' },
  { value: 'EVERY_15_MIN', label: '15 dakika' },
  { value: 'HOURLY', label: 'Saatlik' },
  { value: 'EVERY_4_HOURS', label: '4 saat' },
  { value: 'DAILY', label: 'Günlük' },
  { value: 'MANUAL', label: 'Manuel' },
];

export function AdminIntegrationDetailPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { platformKey = '' } = useParams<{ platformKey: string }>();
  const [form, setForm] = useState<IntegrationFormValues>({});

  const detailQuery = useQuery({
    queryKey: ['admin', 'integrations', platformKey],
    queryFn: async (): Promise<AdminIntegrationDetail> => {
      const { data } = await api.get<AdminIntegrationDetail>(
        `/admin/integrations/${encodeURIComponent(platformKey)}`,
      );
      return data;
    },
    enabled: platformKey.length > 0,
  });

  useEffect(() => {
    if (detailQuery.data) {
      setForm(detailToFormValues(detailQuery.data));
    }
  }, [detailQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (): Promise<AdminIntegrationDetail> => {
      if (!detailQuery.data) {
        throw new Error('Detay yüklenmedi');
      }
      const { data } = await api.put<AdminIntegrationDetail>(
        `/admin/integrations/${encodeURIComponent(platformKey)}`,
        formToUpdatePayload(detailQuery.data, form),
      );
      return data;
    },
    onSuccess: (data) => {
      setForm(detailToFormValues(data));
      void queryClient.invalidateQueries({ queryKey: ['admin', 'integrations'] });
      toast.success(t('admin.pages.integrations.saved'));
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const resetCircuitMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post(`/admin/integrations/${encodeURIComponent(platformKey)}/reset-circuit`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'integrations', platformKey] });
      toast.success(t('admin.pages.integrations.circuitReset'));
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const detail = detailQuery.data;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={detail?.displayName ?? platformKey}
        description={detail?.categoryLabel}
        backLink={{
          to: '/admin/integrations',
          label: t('admin.pages.integrations.backToList'),
        }}
        meta={
          detail ? (
            <Badge variant="outline" className="font-mono text-xs">
              {detail.platformKey}
            </Badge>
          ) : null
        }
      />

      {detailQuery.isLoading ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('admin.pages.integrations.loadingDetail')}
          </CardContent>
        </Card>
      ) : null}

      {detailQuery.isError ? (
        <QueryErrorAlert
          error={detailQuery.error}
          onRetry={() => {
            void detailQuery.refetch();
          }}
        />
      ) : null}

      {detail ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.pages.integrations.healthTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.pages.integrations.healthScore')}
                </p>
                <p className="text-2xl font-semibold tabular-nums">
                  %{detail.health.healthScore}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.pages.integrations.circuitStateLabel')}
                </p>
                <p className="font-medium">
                  {t(`admin.pages.integrations.circuitState.${detail.health.state}`)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.pages.integrations.requestsToday')}
                </p>
                <p className="font-medium tabular-nums">{detail.requestsToday}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {t('admin.pages.integrations.violationsToday')}
                </p>
                <p className="font-medium tabular-nums">{detail.violationsToday}</p>
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={resetCircuitMutation.isPending}
                  onClick={() => {
                    resetCircuitMutation.mutate();
                  }}
                >
                  {resetCircuitMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  {t('admin.pages.integrations.resetCircuit')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('admin.pages.integrations.settingsTitle')}</CardTitle>
              <CardDescription>
                {t('admin.pages.integrations.settingsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(['general', 'sync', 'rateLimit'] as const).map((section) => {
                const sectionFields = detail.fields.filter((f) => f.section === section);
                if (sectionFields.length === 0) {
                  return null;
                }
                return (
                  <div key={section} className="space-y-4">
                    <h3 className="text-sm font-medium">
                      {t(`admin.pages.integrations.sections.${section}`)}
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      {sectionFields.map((field) => {
                        const effective =
                          detail.effective[
                            field.key as keyof typeof detail.effective
                          ];
                        return (
                          <div key={field.key} className="space-y-2">
                            <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                            {field.type === 'boolean' ? (
                              <Switch
                                id={`field-${field.key}`}
                                checked={form[field.key] === true}
                                onCheckedChange={(checked) => {
                                  setForm((prev) => ({ ...prev, [field.key]: checked }));
                                }}
                              />
                            ) : field.type === 'syncFrequency' ? (
                              <Select
                                value={String(form[field.key] ?? '__DEFAULT__')}
                                onValueChange={(value) => {
                                  setForm((prev) => ({
                                    ...prev,
                                    [field.key]:
                                      value === '__DEFAULT__' ? '' : value,
                                  }));
                                }}
                              >
                                <SelectTrigger id={`field-${field.key}`}>
                                  <SelectValue
                                    placeholder={t('admin.pages.integrations.useDefault')}
                                  />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__DEFAULT__">
                                    {t('admin.pages.integrations.useDefault')}
                                  </SelectItem>
                                  {SYNC_FREQUENCY_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                id={`field-${field.key}`}
                                type="number"
                                min={field.min}
                                max={field.max}
                                value={String(form[field.key] ?? '')}
                                placeholder={
                                  effective != null ? String(effective) : undefined
                                }
                                onChange={(e) => {
                                  setForm((prev) => ({
                                    ...prev,
                                    [field.key]: e.target.value,
                                  }));
                                }}
                              />
                            )}
                            {field.description ? (
                              <p className="text-xs text-muted-foreground">
                                {field.description}
                              </p>
                            ) : null}
                            {effective != null && field.type !== 'boolean' ? (
                              <p className="text-xs text-muted-foreground">
                                {t('admin.pages.integrations.effectiveValue', {
                                  value: String(effective),
                                })}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {detail.updatedAt ? (
                <p className="text-sm text-muted-foreground">
                  {t('admin.pages.integrations.lastUpdated', {
                    date: format(new Date(detail.updatedAt), 'd MMM yyyy HH:mm', {
                      locale: tr,
                    }),
                  })}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => {
                    saveMutation.mutate();
                  }}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : null}
                  {t('admin.common.save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    navigate('/admin/integrations');
                  }}
                >
                  {t('admin.common.cancel')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {platformKey.toUpperCase() === 'BIZIMHESAP' ? (
            <>
              <AdminBizimHesapRateLimitTools platformKey={platformKey} />
              <AdminPlatformActivityLog platformKey={platformKey} />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
