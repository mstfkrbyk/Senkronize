import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePageTitle } from '@/hooks/usePageTitle';

import { StockPageHeader } from './StockPageHeader';
import { getApiErrorMessage } from '@/lib/api';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { StockDistributionStrategy } from '@/types/sync-conflict';

import {
  useApplyStockDistribution,
  usePreviewStockDistribution,
  useStockDistribution,
} from './hooks/useStockDistribution';
import { useStockOverview } from './hooks/useStockManagement';

const STRATEGY_LABELS: Record<StockDistributionStrategy, string> = {
  EQUAL: 'Eşit (AI önerisi)',
  PROPORTIONAL: 'Orantılı satış hızı',
  PRIORITY: 'Öncelikli platform',
};

const RESERVE_RULES_KEY = 'senkronize-stock-reserve-rules';

interface ReserveRule {
  id: string;
  platform: string;
  minQty: number;
  minPercent: number;
  blockHbBelowPercent: boolean;
}

function platformLabel(code: string): string {
  if (code === 'CENTRAL') {
    return 'Merkezi';
  }
  return getMarketplaceBranding(code).label;
}

function loadReserveRules(): ReserveRule[] {
  try {
    const raw = localStorage.getItem(RESERVE_RULES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ReserveRule[]) : [];
  } catch {
    return [];
  }
}

function saveReserveRules(rules: ReserveRule[]): void {
  localStorage.setItem(RESERVE_RULES_KEY, JSON.stringify(rules));
}

export function StockDistributionPage(): ReactElement {
  usePageTitle('Stok dağılımı');

  const overviewQuery = useStockOverview();
  const [barcode, setBarcode] = useState('');
  const [strategy, setStrategy] = useState<StockDistributionStrategy>('PROPORTIONAL');
  const [manualAlloc, setManualAlloc] = useState<Record<string, number>>({});
  const [reserveRules, setReserveRules] = useState<ReserveRule[]>(loadReserveRules);

  const distributionQuery = useStockDistribution(barcode.trim() || undefined);
  const previewMutation = usePreviewStockDistribution();
  const applyMutation = useApplyStockDistribution();

  useEffect(() => {
    if (distributionQuery.data?.byPlatform) {
      setManualAlloc({ ...distributionQuery.data.byPlatform });
    }
  }, [distributionQuery.data?.byPlatform, barcode]);

  const totalStock = distributionQuery.data?.totalStock ?? 0;
  const allocated = useMemo(
    () => Object.values(manualAlloc).reduce((s, n) => s + n, 0),
    [manualAlloc],
  );
  const freeStock = Math.max(0, totalStock - allocated);

  const applyAuto = (): void => {
    if (!barcode.trim()) {
      toast.error('Ürün seçin.');
      return;
    }
    previewMutation.mutate(
      { barcode: barcode.trim(), strategy, totalStock },
      {
        onSuccess: (data) => {
          setManualAlloc(data);
          toast.success('AI önerisi yüklendi');
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  const applyManual = (): void => {
    if (!barcode.trim()) {
      return;
    }
    applyMutation.mutate(
      { barcode: barcode.trim(), strategy: 'EQUAL', totalStock },
      {
        onSuccess: () => toast.success('Dağıtım uygulandı'),
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  const addRule = (): void => {
    const next: ReserveRule = {
      id: crypto.randomUUID(),
      platform: 'TRENDYOL',
      minQty: 5,
      minPercent: 20,
      blockHbBelowPercent: true,
    };
    const updated = [...reserveRules, next];
    setReserveRules(updated);
    saveReserveRules(updated);
  };

  const updateRule = (id: string, patch: Partial<ReserveRule>): void => {
    const updated = reserveRules.map((r) =>
      r.id === id ? { ...r, ...patch } : r,
    );
    setReserveRules(updated);
    saveReserveRules(updated);
  };

  const removeRule = (id: string): void => {
    const updated = reserveRules.filter((r) => r.id !== id);
    setReserveRules(updated);
    saveReserveRules(updated);
  };

  return (
    <div className="space-y-6">
      <StockPageHeader
        title="Stok Dağılımı"
        description="Platform başına stok tahsisi, otomatik dağıtım ve rezerv kuralları."
      />

      <Card>
        <CardHeader>
          <CardTitle>Platform tahsisi</CardTitle>
          <CardDescription>
            Toplam, tahsis edilen ve serbest stok miktarları
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:max-w-md">
            <Label>Ürün</Label>
            <Select
              value={barcode || '__none__'}
              onValueChange={(v) => setBarcode(v === '__none__' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Ürün seçin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Seçin…</SelectItem>
                {(overviewQuery.data ?? []).map((row) => (
                  <SelectItem key={row.barcode} value={row.barcode}>
                    {row.productName ?? row.barcode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {barcode.trim() ? (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="tabular-nums">
                  Toplam: {totalStock.toLocaleString('tr-TR')}
                </Badge>
                <Badge variant="outline" className="tabular-nums">
                  Tahsis: {allocated.toLocaleString('tr-TR')}
                </Badge>
                <Badge
                  className="bg-sky-500 tabular-nums text-white hover:bg-sky-500"
                >
                  Serbest: {freeStock.toLocaleString('tr-TR')}
                </Badge>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label>Dağıtım stratejisi</Label>
                  <Select
                    value={strategy}
                    onValueChange={(v) =>
                      setStrategy(v as StockDistributionStrategy)
                    }
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STRATEGY_LABELS) as StockDistributionStrategy[]).map(
                        (k) => (
                          <SelectItem key={k} value={k}>
                            {STRATEGY_LABELS[k]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  disabled={previewMutation.isPending}
                  onClick={applyAuto}
                >
                  <Sparkles className="mr-1 size-4" aria-hidden />
                  Otomatik Dağıt
                </Button>
                <Button
                  disabled={applyMutation.isPending}
                  onClick={applyManual}
                >
                  Dağıtımı Uygula
                </Button>
              </div>

              {distributionQuery.isLoading ? (
                <p className="text-muted-foreground text-sm">Yükleniyor…</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Platform</TableHead>
                        <TableHead className="text-right w-[140px]">
                          Tahsis
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(manualAlloc).map(([platform, qty]) => (
                        <TableRow key={platform}>
                          <TableCell>{platformLabel(platform)}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              className="text-right tabular-nums"
                              value={qty}
                              onChange={(e) =>
                                setManualAlloc((prev) => ({
                                  ...prev,
                                  [platform]: Number(e.target.value),
                                }))
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                      {Object.keys(manualAlloc).length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={2}
                            className="text-muted-foreground text-center"
                          >
                            Platform stok satırı yok.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-muted-foreground text-xs">
                Manuel düzenleme: satırlardaki sayıları değiştirin, ardından
                &quot;Dağıtımı Uygula&quot; ile kaydedin.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Dağılımı görmek için bir ürün seçin.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Stok rezerv kuralları</CardTitle>
            <CardDescription>
              Platform minimum stok ve HB yönlendirme eşikleri (yerel kayıt)
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={addRule}>
            Kural ekle
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {reserveRules.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Örnek: &quot;Trendyol için minimum 10 adet tut&quot; veya
              &quot;Stok %20 altında HB&apos;ye gönderme&quot;.
            </p>
          ) : (
            reserveRules.map((rule) => (
              <div
                key={rule.id}
                className="grid gap-3 rounded-lg border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"
              >
                <div className="space-y-1">
                  <Label>Platform</Label>
                  <Input
                    value={rule.platform}
                    onChange={(e) =>
                      updateRule(rule.id, { platform: e.target.value })
                    }
                    placeholder="TRENDYOL"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Minimum adet</Label>
                  <Input
                    type="number"
                    min={0}
                    value={rule.minQty}
                    onChange={(e) =>
                      updateRule(rule.id, { minQty: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <Label>Minimum %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={rule.minPercent}
                    onChange={(e) =>
                      updateRule(rule.id, {
                        minPercent: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div className="flex items-end gap-2">
                  <label className="flex flex-1 items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={rule.blockHbBelowPercent}
                      onChange={(e) =>
                        updateRule(rule.id, {
                          blockHbBelowPercent: e.target.checked,
                        })
                      }
                    />
                    %20 altında HB&apos;ye gönderme
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => removeRule(rule.id)}
                  >
                    Sil
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
