import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { SettingsPageShell } from '@/components/settings/SettingsPageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { api, getApiErrorMessage } from '@/lib/api';
import type { OrganizationDetail } from '@/types/organization';

const DEFAULT_CURRENCIES = [
  'TRY',
  'USD',
  'EUR',
  'GBP',
  'SAR',
  'AED',
  'PLN',
  'RON',
  'HUF',
  'CZK',
] as const;

const MANUAL_CODES = [
  'USD',
  'EUR',
  'GBP',
  'SAR',
  'AED',
  'PLN',
  'RON',
  'HUF',
  'CZK',
] as const;

export function CurrencyTab(): ReactElement {
  const queryClient = useQueryClient();
  const [defaultCurrency, setDefaultCurrency] = useState('TRY');
  const [preferManual, setPreferManual] = useState(false);
  const [tcmbEnabled, setTcmbEnabled] = useState(true);
  const [manualInputs, setManualInputs] = useState<Record<string, string>>({});

  const orgQuery = useQuery({
    queryKey: ['organizations', 'me'],
    queryFn: async (): Promise<OrganizationDetail> => {
      const { data } = await api.get<OrganizationDetail>('/organizations/me');
      return data;
    },
  });

  useEffect(() => {
    const o = orgQuery.data;
    if (!o) {
      return;
    }
    setDefaultCurrency(o.defaultCurrency ?? 'TRY');
    setPreferManual(o.currencyPreferManualRates ?? false);
    setTcmbEnabled(o.currencyTcmbEnabled ?? true);
    const next: Record<string, string> = {};
    const src = o.currencyManualRates ?? {};
    for (const code of MANUAL_CODES) {
      const v = src[code];
      next[code] = v != null && Number.isFinite(v) ? String(v) : '';
    }
    setManualInputs(next);
  }, [orgQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (): Promise<OrganizationDetail> => {
      const manual: Record<string, number> = {};
      for (const code of MANUAL_CODES) {
        const raw = manualInputs[code]?.trim();
        if (raw === '') {
          continue;
        }
        const n = Number(raw.replace(',', '.'));
        if (!Number.isFinite(n) || n <= 0) {
          throw new Error(`${code} için geçerli pozitif bir sayı girin.`);
        }
        manual[code] = n;
      }
      const { data } = await api.patch<OrganizationDetail>('/organizations/me', {
        defaultCurrency,
        currencyPreferManualRates: preferManual,
        currencyTcmbEnabled: tcmbEnabled,
        currencyManualRates: Object.keys(manual).length > 0 ? manual : {},
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['organizations', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['reports', 'profit'] });
      toast.success('Para birimi ayarları kaydedildi.');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : getApiErrorMessage(err));
    },
  });

  const dirty = useMemo(() => {
    const o = orgQuery.data;
    if (!o) {
      return false;
    }
    if ((o.defaultCurrency ?? 'TRY') !== defaultCurrency) {
      return true;
    }
    if ((o.currencyPreferManualRates ?? false) !== preferManual) {
      return true;
    }
    if ((o.currencyTcmbEnabled ?? true) !== tcmbEnabled) {
      return true;
    }
    const prev = o.currencyManualRates ?? {};
    for (const code of MANUAL_CODES) {
      const prevVal = prev[code];
      const raw = manualInputs[code]?.trim() ?? '';
      if (raw === '' && prevVal == null) {
        continue;
      }
      if (raw === '' && prevVal != null) {
        return true;
      }
      const n = Number(raw.replace(',', '.'));
      if (Number.isFinite(n) && n > 0 && prevVal !== n) {
        return true;
      }
      if (raw !== '' && (!Number.isFinite(n) || n <= 0)) {
        return true;
      }
    }
    return false;
  }, [
    orgQuery.data,
    defaultCurrency,
    preferManual,
    tcmbEnabled,
    manualInputs,
  ]);

  if (orgQuery.isLoading) {
    return (
      <SettingsPageShell
        title="Para Birimi"
        description="Varsayılan para birimi ve görüntüleme biçimini ayarlayın."
      >
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </SettingsPageShell>
    );
  }

  if (orgQuery.isError) {
    return (
      <SettingsPageShell
        title="Para Birimi"
        description="Varsayılan para birimi ve görüntüleme biçimini ayarlayın."
      >
        <QueryErrorAlert
          error={orgQuery.error}
          onRetry={() => {
            void orgQuery.refetch();
          }}
        />
      </SettingsPageShell>
    );
  }

  return (
    <SettingsPageShell
      title="Para Birimi"
      description="Varsayılan para birimi ve görüntüleme biçimini ayarlayın."
    >
      <Card>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <Label htmlFor="default-currency">Varsayılan para birimi</Label>
            <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
              <SelectTrigger id="default-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEFAULT_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="tcmb-toggle">TCMB otomatik kurlar</Label>
              <p className="text-xs text-muted-foreground">
                Kapalıysa raporlarda yalnızca aşağıdaki manuel kurlar kullanılır (veya ham tutar).
              </p>
            </div>
            <Switch
              id="tcmb-toggle"
              checked={tcmbEnabled}
              onCheckedChange={setTcmbEnabled}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="manual-priority">Manuel kura öncelik</Label>
              <p className="text-xs text-muted-foreground">
                Açıksa, girilen manuel kurlar TCMB değerinin üzerine yazar.
              </p>
            </div>
            <Switch
              id="manual-priority"
              checked={preferManual}
              onCheckedChange={setPreferManual}
            />
          </div>

          <div className="space-y-3">
            <Label>Manuel kur (1 birim = kaç TRY)</Label>
            <p className="text-xs text-muted-foreground">
              Boş bırakılan kodlar için TCMB (açıksa) veya son bilinen kur kullanılır.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {MANUAL_CODES.map((code) => (
                <div key={code} className="space-y-1">
                  <Label className="text-xs text-muted-foreground" htmlFor={`fx-${code}`}>
                    {code}
                  </Label>
                  <Input
                    id={`fx-${code}`}
                    inputMode="decimal"
                    placeholder="Örn. 34,52"
                    value={manualInputs[code] ?? ''}
                    onChange={(e) =>
                      setManualInputs((prev) => ({ ...prev, [code]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <Button
            type="button"
            disabled={!dirty || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </CardContent>
      </Card>
    </SettingsPageShell>
  );
}
