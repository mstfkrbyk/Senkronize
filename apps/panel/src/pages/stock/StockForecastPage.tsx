import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/TableSkeleton';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import type {
  SeasonalityDataDto,
  StockForecastSummaryDto,
  StockoutEstimateDto,
  StockProjectionDto,
} from '@/types/stock-forecast';

function rowToneClass(days: number | null): string {
  if (days === null || !Number.isFinite(days)) {
    return '';
  }
  if (days < 7) {
    return 'bg-red-50/90 dark:bg-red-950/30';
  }
  if (days < 14) {
    return 'bg-amber-50/90 dark:bg-amber-950/25';
  }
  return 'bg-emerald-50/60 dark:bg-emerald-950/20';
}

function daysBadgeLabel(days: number | null): string {
  if (days === null || !Number.isFinite(days)) {
    return 'Veri yok';
  }
  if (days < 0) {
    return 'Tükendi';
  }
  return `${days.toFixed(1)} gün`;
}

interface ReorderDraft {
  reorderPoint: string;
  reorderQty: string;
  leadTimeDays: string;
}

function toDraft(row: StockoutEstimateDto): ReorderDraft {
  return {
    reorderPoint:
      row.reorderPoint !== null && row.reorderPoint !== undefined
        ? String(row.reorderPoint)
        : '',
    reorderQty:
      row.reorderQty !== null && row.reorderQty !== undefined
        ? String(row.reorderQty)
        : '',
    leadTimeDays:
      row.leadTimeDays !== null && row.leadTimeDays !== undefined
        ? String(row.leadTimeDays)
        : '',
  };
}

export function StockForecastPage(): ReactElement {
  usePageTitle('Stok tahmini');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBarcode, setSelectedBarcode] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ReorderDraft>>({});

  const summaryQuery = useQuery({
    queryKey: ['stock-forecast', 'summary'],
    queryFn: async (): Promise<StockForecastSummaryDto> => {
      const { data } = await api.get<StockForecastSummaryDto>(
        '/stock/forecast/summary',
      );
      return data;
    },
  });

  const forecastQuery = useQuery({
    queryKey: ['stock-forecast', 'bulk'],
    queryFn: async (): Promise<StockoutEstimateDto[]> => {
      const { data } = await api.get<{ data: StockoutEstimateDto[] }>(
        '/stock/forecast',
      );
      return data.data;
    },
  });

  const rows = forecastQuery.data ?? [];

  useEffect(() => {
    if (rows.length === 0) {
      return;
    }
    setDrafts((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (next[r.productId] === undefined) {
          next[r.productId] = toDraft(r);
        }
      }
      return next;
    });
    setSelectedBarcode((prev) => {
      if (prev !== null && rows.some((r) => r.barcode === prev)) {
        return prev;
      }
      return rows[0]?.barcode ?? null;
    });
  }, [rows]);

  const projectionQuery = useQuery({
    queryKey: ['stock-forecast', 'projection', selectedBarcode],
    queryFn: async (): Promise<StockProjectionDto> => {
      const { data } = await api.get<StockProjectionDto>(
        `/stock/forecast/${encodeURIComponent(selectedBarcode ?? '')}/projection`,
      );
      return data;
    },
    enabled: Boolean(selectedBarcode),
  });

  const seasonalityQuery = useQuery({
    queryKey: ['stock-forecast', 'seasonality', selectedBarcode],
    queryFn: async (): Promise<SeasonalityDataDto> => {
      const { data } = await api.get<SeasonalityDataDto>(
        `/stock/forecast/${encodeURIComponent(selectedBarcode ?? '')}/seasonality`,
      );
      return data;
    },
    enabled: Boolean(selectedBarcode),
  });

  const reorderMutation = useMutation({
    mutationFn: async (payload: {
      productId: string;
      reorderPoint?: number;
      reorderQty?: number;
      leadTimeDays?: number;
    }): Promise<void> => {
      await api.patch(`/products/${payload.productId}/reorder`, {
        ...(payload.reorderPoint !== undefined && {
          reorderPoint: payload.reorderPoint,
        }),
        ...(payload.reorderQty !== undefined && { reorderQty: payload.reorderQty }),
        ...(payload.leadTimeDays !== undefined && {
          leadTimeDays: payload.leadTimeDays,
        }),
      });
    },
    onSuccess: async () => {
      toast.success('Sipariş eşiği güncellendi.');
      await queryClient.invalidateQueries({ queryKey: ['stock-forecast'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  const commitReorder = useCallback(
    (row: StockoutEstimateDto): void => {
      const d = drafts[row.productId];
      if (!d) {
        return;
      }
      const body: {
        reorderPoint?: number;
        reorderQty?: number;
        leadTimeDays?: number;
      } = {};
      if (d.reorderPoint.trim() !== '') {
        const n = Number.parseInt(d.reorderPoint, 10);
        if (!Number.isNaN(n) && n >= 0) {
          body.reorderPoint = n;
        }
      }
      if (d.reorderQty.trim() !== '') {
        const n = Number.parseInt(d.reorderQty, 10);
        if (!Number.isNaN(n) && n >= 0) {
          body.reorderQty = n;
        }
      }
      if (d.leadTimeDays.trim() !== '') {
        const n = Number.parseInt(d.leadTimeDays, 10);
        if (!Number.isNaN(n) && n >= 0) {
          body.leadTimeDays = n;
        }
      }
      if (Object.keys(body).length === 0) {
        toast.message('Kaydedilecek alan yok', {
          description: 'Min stok, sipariş miktarı veya tedarik süresi girin.',
        });
        return;
      }
      reorderMutation.mutate({ productId: row.productId, ...body });
    },
    [drafts, reorderMutation],
  );

  const chartData = useMemo(() => {
    const pts = projectionQuery.data?.points ?? [];
    return pts.map((p) => ({
      label: format(parseISO(p.date), 'd MMM', { locale: tr }),
      tahmin: p.projectedStock,
    }));
  }, [projectionQuery.data]);

  const summary = summaryQuery.data;
  const isLoading = summaryQuery.isPending || forecastQuery.isPending;
  const isError = summaryQuery.isError || forecastQuery.isError;

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-auto p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary">
          Stok tahmini
        </h1>
        <p className="text-sm text-muted-foreground">
          Satış hızına göre tükenme tarihi, önerilen sipariş ve min stok eşiği.
        </p>
      </div>

      {isError ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle>Veri alınamadı</CardTitle>
            <CardDescription>
              Stok tahmini uç noktalarına erişilemedi. Oturumu ve bağlantıları
              kontrol edin.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ≤ 7 gün
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-2xl font-bold text-red-700 tabular-nums dark:text-red-400">
                {summary?.countWithin7Days ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ≤ 14 gün
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-2xl font-bold text-amber-800 tabular-nums dark:text-amber-300">
                {summary?.countWithin14Days ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              ≤ 30 gün
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-2xl font-bold text-emerald-800 tabular-nums dark:text-emerald-300">
                {summary?.countWithin30Days ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tahmini yenileme maliyeti (30 gün)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <p className="text-2xl font-bold tabular-nums">
                {new Intl.NumberFormat('tr-TR', {
                  style: 'currency',
                  currency: 'TRY',
                  maximumFractionDigits: 0,
                }).format(summary?.estimatedRestockCostThisMonthTry ?? 0)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Ürün listesi</CardTitle>
            <CardDescription>
              Kırmızı: 7 günden az, turuncu: 7–14 gün, yeşil: 14 günden fazla.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <TableSkeleton rows={8} cols={10} />
            ) : rows.length === 0 ? (
              <EmptyState
                title="Tahmin için ürün yok"
                description="Katalogda ürün ekleyin ve sipariş geçmişi oluşunca satış hızı hesaplanır."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ürün</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Stok</TableHead>
                    <TableHead className="text-right">Günlük hız</TableHead>
                    <TableHead>Tükenme</TableHead>
                    <TableHead className="text-right">Öneri</TableHead>
                    <TableHead className="w-24">Min stok</TableHead>
                    <TableHead className="w-24">Sip. adet</TableHead>
                    <TableHead className="w-24">Lead (gün)</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const draft = drafts[row.productId] ?? toDraft(row);
                    const selected = row.barcode === selectedBarcode;
                    return (
                      <TableRow
                        key={row.productId}
                        className={`cursor-pointer ${rowToneClass(row.daysUntilStockout)} ${selected ? 'ring-1 ring-sky-400' : ''}`}
                        onClick={() => {
                          setSelectedBarcode(row.barcode);
                        }}
                      >
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.sku ?? '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.currentStock}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.dailyVelocity}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant="outline" className="w-fit">
                              {daysBadgeLabel(row.daysUntilStockout)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {row.estimatedStockoutDate
                                ? format(
                                    parseISO(row.estimatedStockoutDate),
                                    'd MMM yyyy',
                                    { locale: tr },
                                  )
                                : '—'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.recommendedOrderQty}
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8"
                            inputMode="numeric"
                            value={draft.reorderPoint}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onChange={(e) => {
                              setDrafts((p) => ({
                                ...p,
                                [row.productId]: {
                                  ...draft,
                                  reorderPoint: e.target.value,
                                },
                              }));
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8"
                            inputMode="numeric"
                            value={draft.reorderQty}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onChange={(e) => {
                              setDrafts((p) => ({
                                ...p,
                                [row.productId]: {
                                  ...draft,
                                  reorderQty: e.target.value,
                                },
                              }));
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8"
                            inputMode="numeric"
                            value={draft.leadTimeDays}
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            onChange={(e) => {
                              setDrafts((p) => ({
                                ...p,
                                [row.productId]: {
                                  ...draft,
                                  leadTimeDays: e.target.value,
                                },
                              }));
                            }}
                          />
                        </TableCell>
                        <TableCell className="space-y-1 whitespace-nowrap">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="w-full"
                            disabled={reorderMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              commitReorder(row);
                            }}
                          >
                            Kaydet
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="w-full gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              const params = new URLSearchParams();
                              params.set('barcode', row.barcode);
                              params.set('name', row.name);
                              params.set(
                                'qty',
                                String(Math.max(1, row.recommendedOrderQty || 1)),
                              );
                              navigate(`/suppliers?${params.toString()}`);
                            }}
                          >
                            <ShoppingCart className="size-3.5" aria-hidden />
                            Yeniden Sipariş Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Stok gidişatı (30 gün)</CardTitle>
            <CardDescription>
              {selectedBarcode
                ? `Barkod: ${selectedBarcode}`
                : 'Tablodan ürün seçin.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            {projectionQuery.isPending && selectedBarcode ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : projectionQuery.isError ? (
              <p className="text-sm text-destructive">Grafik yüklenemedi.</p>
            ) : chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">Grafik için veri yok.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => {
                      const v =
                        value === null || value === undefined
                          ? ''
                          : typeof value === 'number'
                            ? value.toFixed(0)
                            : String(value);
                      return [v, ''];
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="tahmin"
                    name="Tahmini stok"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={false}
                  />
                  {projectionQuery.data?.reorderPoint !== null &&
                  projectionQuery.data?.reorderPoint !== undefined ? (
                    <ReferenceLine
                      y={projectionQuery.data.reorderPoint}
                      stroke="#64748b"
                      strokeDasharray="4 4"
                      label={{ value: 'Min stok', position: 'right', fill: '#64748b' }}
                    />
                  ) : null}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
          {seasonalityQuery.data ? (
            <CardContent className="border-t pt-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Sezonsallık: </span>
              Son 30 gün hız {seasonalityQuery.data.recentVelocity}, önceki 30 gün{' '}
              {seasonalityQuery.data.priorVelocity}. Endeks{' '}
              {seasonalityQuery.data.seasonalityIndex} (
              {seasonalityQuery.data.trendLabel})
            </CardContent>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
