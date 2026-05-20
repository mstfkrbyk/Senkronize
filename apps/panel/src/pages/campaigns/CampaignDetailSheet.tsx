import type { ReactElement } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CampaignStatus } from '@/types/campaign';

import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TYPE_LABELS,
  DISCOUNT_TYPE_LABELS,
  formatCampaignDate,
  formatMoney,
  platformLabel,
} from './campaign-labels';
import {
  useActivateCampaign,
  useCampaign,
  useCampaignPerformance,
  useDeactivateCampaign,
  useDuplicateCampaign,
  usePauseCampaign,
} from './hooks/useCampaigns';

interface Props {
  campaignId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_ORDER: CampaignStatus[] = [
  'DRAFT',
  'SCHEDULED',
  'ACTIVE',
  'PAUSED',
  'ENDED',
];

function statusBadgeVariant(
  status: CampaignStatus,
): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'SCHEDULED':
      return 'secondary';
    case 'PAUSED':
      return 'outline';
    case 'ENDED':
      return 'destructive';
    default:
      return 'outline';
  }
}

export function CampaignDetailSheet({
  campaignId,
  open,
  onOpenChange,
}: Props): ReactElement {
  const detailQuery = useCampaign(campaignId, open);
  const performanceQuery = useCampaignPerformance(campaignId, open);
  const activateMutation = useActivateCampaign();
  const pauseMutation = usePauseCampaign();
  const deactivateMutation = useDeactivateCampaign();
  const duplicateMutation = useDuplicateCampaign();

  const campaign = detailQuery.data;
  const performance = performanceQuery.data;
  const usageChartData = (performance?.usageByDay ?? []).map((p) => ({
    label: p.date.slice(5),
    kullanim: p.usageCount,
  }));
  const isBusy =
    activateMutation.isPending ||
    pauseMutation.isPending ||
    deactivateMutation.isPending ||
    duplicateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Kampanya detayı</SheetTitle>
        </SheetHeader>

        {detailQuery.isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : detailQuery.isError || !campaign ? (
          <p className="py-8 text-sm text-destructive">
            Kampanya yüklenemedi.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold">{campaign.name}</h2>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary">
                  {CAMPAIGN_TYPE_LABELS[campaign.type]}
                </Badge>
                <Badge variant={statusBadgeVariant(campaign.status)}>
                  {CAMPAIGN_STATUS_LABELS[campaign.status]}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Durum zaman çizelgesi</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_ORDER.map((status) => {
                  const active =
                    STATUS_ORDER.indexOf(status) <=
                    STATUS_ORDER.indexOf(campaign.status);
                  return (
                    <div
                      key={status}
                      className={`rounded-full px-3 py-1 text-xs ${
                        active
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {CAMPAIGN_STATUS_LABELS[status]}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatCampaignDate(campaign.startDate)}
                {campaign.endDate
                  ? ` → ${formatCampaignDate(campaign.endDate)}`
                  : ''}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">İndirim</p>
                <p>
                  {DISCOUNT_TYPE_LABELS[campaign.discountType]}:{' '}
                  {campaign.discountValue}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Kupon kodu</p>
                <p className="font-mono">{campaign.couponCode ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Etkilenen ürün</p>
                <p>{campaign.affectedProductCount}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Min. sipariş</p>
                <p>
                  {campaign.minOrderAmount
                    ? formatMoney(campaign.minOrderAmount)
                    : '—'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Platformlar</p>
                <p>{campaign.platforms.map(platformLabel).join(', ')}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Min fiyat</p>
                <p>
                  {campaign.minPrice
                    ? formatMoney(campaign.minPrice)
                    : '—'}
                </p>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">Performans</p>
              {performanceQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Yükleniyor…</p>
              ) : performance ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-muted-foreground">Kullanım</p>
                      <p className="font-semibold tabular-nums">
                        {performance.usageCount}
                        {performance.maxUses !== null
                          ? ` / ${performance.maxUses}`
                          : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Toplam indirim</p>
                      <p className="font-semibold tabular-nums">
                        {formatMoney(performance.totalDiscountAmount)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Dönüşüm</p>
                      <p className="font-semibold tabular-nums">
                        %{performance.conversionRate.toLocaleString('tr-TR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Gösterim</p>
                      <p className="font-semibold tabular-nums">
                        {performance.impressions}
                      </p>
                    </div>
                  </div>
                  {usageChartData.length > 0 ? (
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={usageChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} width={32} />
                          <Tooltip
                            formatter={(value) => [
                              typeof value === 'number' ? value : 0,
                              'Kullanım',
                            ]}
                          />
                          <Bar
                            dataKey="kullanim"
                            fill="hsl(var(--primary))"
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Performans verisi alınamadı.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isBusy}
                className="gap-1"
                onClick={() =>
                  void duplicateMutation.mutateAsync(campaign.id)
                }
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Kopyala
              </Button>
              {campaign.status === 'DRAFT' ||
              campaign.status === 'SCHEDULED' ||
              campaign.status === 'PAUSED' ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => void activateMutation.mutateAsync(campaign.id)}
                >
                  Aktifleştir
                </Button>
              ) : null}
              {campaign.status === 'ACTIVE' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={() => void pauseMutation.mutateAsync(campaign.id)}
                >
                  Duraklat
                </Button>
              ) : null}
              {campaign.status === 'ACTIVE' ||
              campaign.status === 'PAUSED' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={isBusy}
                  onClick={() =>
                    void deactivateMutation.mutateAsync(campaign.id)
                  }
                >
                  Sonlandır
                </Button>
              ) : null}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Etkilenen ürünler</p>
              {campaign.affectedProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Etkilenecek ürün bulunamadı.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ürün</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead className="text-right">Fiyat</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaign.affectedProducts.slice(0, 50).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div className="max-w-[180px] truncate text-sm">
                              {row.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.barcode}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {platformLabel(row.platform)}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {formatMoney(row.currentPrice)}
                            {campaign.status === 'ACTIVE' ? (
                              <div className="text-xs text-muted-foreground line-through">
                                {row.originalPrice
                                  ? formatMoney(row.originalPrice)
                                  : null}
                              </div>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
