import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

import { toast } from 'sonner';

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
  EQUAL: 'Eşit dağıtım',
  PROPORTIONAL: 'Orantılı (satış hızı)',
  PRIORITY: 'Öncelikli (yüksek dönüşüm)',
};

function platformLabel(code: string): string {
  if (code === 'CENTRAL') {
    return 'Merkezi';
  }
  return getMarketplaceBranding(code).label;
}

export function StockDistributionTab(): ReactElement {
  const overviewQuery = useStockOverview();
  const [barcode, setBarcode] = useState('');
  const [strategy, setStrategy] = useState<StockDistributionStrategy>('EQUAL');
  const [totalStock, setTotalStock] = useState<number | undefined>(undefined);
  const [preview, setPreview] = useState<Record<string, number> | null>(null);

  const distributionQuery = useStockDistribution(barcode.trim() || undefined);
  const previewMutation = usePreviewStockDistribution();
  const applyMutation = useApplyStockDistribution();

  useEffect(() => {
    if (distributionQuery.data && totalStock === undefined) {
      setTotalStock(distributionQuery.data.totalStock);
    }
  }, [distributionQuery.data, totalStock]);

  const loadPreview = (): void => {
    if (!barcode.trim()) {
      toast.error('Lütfen bir barkod seçin.');
      return;
    }
    previewMutation.mutate(
      {
        barcode: barcode.trim(),
        strategy,
        totalStock,
      },
      {
        onSuccess: (data) => setPreview(data),
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  const apply = (): void => {
    if (!barcode.trim()) {
      return;
    }
    applyMutation.mutate(
      {
        barcode: barcode.trim(),
        strategy,
        totalStock,
      },
      {
        onSuccess: (data) => {
          setPreview(data.distribution);
          toast.success('Stok dağıtımı uygulandı');
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Stok dağıtımı</CardTitle>
          <CardDescription>
            Toplam stoku platformlar arasında stratejiye göre paylaştırın.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="dist-barcode">Ürün (barkod)</Label>
              <Select
                value={barcode || '__none__'}
                onValueChange={(v) => {
                  const next = v === '__none__' ? '' : v;
                  setBarcode(next);
                  setPreview(null);
                  setTotalStock(undefined);
                }}
              >
                <SelectTrigger id="dist-barcode">
                  <SelectValue placeholder="Ürün seçin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Seçin…</SelectItem>
                  {(overviewQuery.data ?? []).map((row) => (
                    <SelectItem key={row.barcode} value={row.barcode}>
                      {row.productName ?? row.barcode} ({row.barcode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Strateji</Label>
              <Select
                value={strategy}
                onValueChange={(v) => {
                  setStrategy(v as StockDistributionStrategy);
                  setPreview(null);
                }}
              >
                <SelectTrigger>
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
            <div className="space-y-1">
              <Label htmlFor="dist-total">Toplam stok</Label>
              <Input
                id="dist-total"
                type="number"
                min={0}
                value={totalStock ?? ''}
                onChange={(e) => {
                  setTotalStock(Number(e.target.value));
                  setPreview(null);
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!barcode.trim() || previewMutation.isPending}
              onClick={loadPreview}
            >
              Önizle
            </Button>
            <Button
              disabled={!barcode.trim() || applyMutation.isPending}
              onClick={apply}
            >
              Uygula
            </Button>
          </div>
        </CardContent>
      </Card>

      {barcode.trim() ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mevcut dağılım</CardTitle>
            </CardHeader>
            <CardContent>
              {distributionQuery.isLoading ? (
                <p className="text-muted-foreground text-sm">Yükleniyor…</p>
              ) : distributionQuery.isError ? (
                <p className="text-destructive text-sm">
                  {getApiErrorMessage(distributionQuery.error)}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(distributionQuery.data?.byPlatform ?? {}).map(
                    ([platform, qty]) => (
                      <Badge key={platform} variant="outline" className="tabular-nums">
                        {platformLabel(platform)}: {qty.toLocaleString('tr-TR')}
                      </Badge>
                    ),
                  )}
                  {(Object.keys(distributionQuery.data?.byPlatform ?? {}).length ??
                    0) === 0 ? (
                    <p className="text-muted-foreground text-sm">Kayıt yok.</p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Önizleme</CardTitle>
              <CardDescription>Seçilen stratejiye göre planlanan dağılım</CardDescription>
            </CardHeader>
            <CardContent>
              {!preview ? (
                <p className="text-muted-foreground text-sm">
                  Önizlemek için &quot;Önizle&quot; butonuna tıklayın.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(preview).map(([platform, qty]) => (
                    <Badge
                      key={platform}
                      className="bg-sky-500 tabular-nums text-white hover:bg-sky-500"
                    >
                      {platformLabel(platform)}: {qty.toLocaleString('tr-TR')}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
