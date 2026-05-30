import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { AlertTriangle, Bell, Plus, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { useAuthStore } from '@/store/auth.store';
import { useListings } from '@/pages/listings/hooks/useListings';
import type { CompetitorMatrixPlatformCell } from '@/types/pricing';

import {
  useCompetitorMatrix,
  useCreatePriceAlert,
  useCreateRule,
  useListingPriceHistory,
  usePriceAlerts,
} from './hooks/usePricing';

const money = (value: string | number | null | undefined): string => {
  const n = typeof value === 'string' ? Number(value) : value;
  if (n == null || Number.isNaN(n)) {
    return '—';
  }
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 2,
  }).format(n);
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manuel',
  rule: 'Kural',
  campaign: 'Kampanya',
  sync: 'Senkronizasyon',
};

function hasProAccess(plan: string | undefined): boolean {
  return plan === 'PRO' || plan === 'KURUMSAL';
}

export function PriceAnalysisPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(groupLabel, t('nav.priceAnalysis'));
  usePageTitle(t('pricing.analysis.pageTitle'));
  const plan = useAuthStore((s) => s.currentOrg?.plan);
  const proAccess = hasProAccess(plan);
  const [search, setSearch] = useState('');
  const [selectedListingId, setSelectedListingId] = useState<string>('');
  const [historyDays, setHistoryDays] = useState('30');
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertListingId, setAlertListingId] = useState('');
  const [alertThreshold, setAlertThreshold] = useState('');
  const [alertEmail, setAlertEmail] = useState(true);
  const [alertInApp, setAlertInApp] = useState(true);
  const [alertSms, setAlertSms] = useState(false);

  const listingsQuery = useListings({ page: 1, limit: 200 }, proAccess);
  const historyQuery = useListingPriceHistory(
    selectedListingId === '' ? null : selectedListingId,
    Number(historyDays),
    proAccess,
  );
  const matrixQuery = useCompetitorMatrix(proAccess);
  const alertsQuery = usePriceAlerts(proAccess);
  const createAlert = useCreatePriceAlert();
  const createRule = useCreateRule();

  const filteredListings = useMemo(() => {
    const items = listingsQuery.data?.items ?? [];
    const q = search.trim().toLowerCase();
    if (q.length === 0) {
      return items;
    }
    return items.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.barcode.toLowerCase().includes(q),
    );
  }, [listingsQuery.data?.items, search]);

  const chartData = useMemo(
    () =>
      (historyQuery.data?.chart ?? []).map((p) => ({
        ...p,
        label: format(new Date(p.date), 'd MMM', { locale: tr }),
      })),
    [historyQuery.data?.chart],
  );

  const handleMatchPrice = (
    barcode: string,
    platform: string,
    targetPrice: number | null,
  ): void => {
    if (targetPrice == null) {
      return;
    }
    createRule.mutate({
      name: `${barcode.slice(0, 12)} — fiyat eşitleme`,
      platform,
      strategy: 'MATCH_BUYBOX',
      minMarginPct: '5',
      maxDiscountPct: '25',
      targetPosition: 1,
      isActive: true,
      applyToAll: false,
      barcodes: [barcode],
    });
  };

  const handleCreateAlert = (): void => {
    const threshold = Number(alertThreshold);
    if (alertListingId === '' || Number.isNaN(threshold) || threshold <= 0) {
      return;
    }
    createAlert.mutate(
      {
        listingId: alertListingId,
        thresholdPrice: threshold,
        notifyEmail: alertEmail,
        notifyInApp: alertInApp,
        notifySms: alertSms,
      },
      {
        onSuccess: () => {
          setAlertOpen(false);
          setAlertThreshold('');
          setAlertListingId('');
        },
      },
    );
  };

  if (!proAccess) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={t('pricing.analysis.title')}
          context={navContextLine}
        />
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {t('pricing.analysis.upgrade')}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('pricing.analysis.title')}
        description={t('pricing.analysis.subtitle')}
        context={navContextLine}
      />

      <Card>
        <CardContent className="pt-6">
      <Tabs defaultValue="history" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="history">Fiyat geçmişi</TabsTrigger>
          <TabsTrigger value="matrix">Rakip matrisi</TabsTrigger>
          <TabsTrigger value="alerts">Fiyat uyarıları</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ürün seçimi</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  className="pl-9"
                  placeholder="Barkod veya ürün adı ara…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="w-full sm:w-48">
                <Label htmlFor="history-days" className="sr-only">
                  Gün aralığı
                </Label>
                <Select value={historyDays} onValueChange={setHistoryDays}>
                  <SelectTrigger id="history-days">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Son 7 gün</SelectItem>
                    <SelectItem value="30">Son 30 gün</SelectItem>
                    <SelectItem value="90">Son 90 gün</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <div className="max-h-80 overflow-y-auto rounded-md border">
              {listingsQuery.isLoading ? (
                <TableSkeleton rows={6} cols={1} />
              ) : (
                <ul className="divide-y">
                  {filteredListings.slice(0, 50).map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        className={`w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
                          selectedListingId === l.id
                            ? 'bg-sky-50 font-medium text-sky-900'
                            : ''
                        }`}
                        onClick={() => setSelectedListingId(l.id)}
                      >
                        <span className="line-clamp-1">{l.title}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {l.barcode} · {l.platform}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-4">
              {selectedListingId === '' ? (
                <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Grafik ve tablo için soldan bir ürün seçin.
                </p>
              ) : historyQuery.isLoading ? (
                <Skeleton className="h-72 w-full rounded-lg" />
              ) : historyQuery.isError ? (
                <QueryErrorAlert
                  error={historyQuery.error}
                  onRetry={() => {
                    void historyQuery.refetch();
                  }}
                />
              ) : historyQuery.data ? (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">
                        {historyQuery.data.title}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Güncel fiyat: {money(historyQuery.data.currentPrice)}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={chartData}
                            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                            <YAxis
                              tick={{ fontSize: 11 }}
                              tickFormatter={(v: number) =>
                                new Intl.NumberFormat('tr-TR', {
                                  notation: 'compact',
                                  maximumFractionDigits: 0,
                                }).format(v)
                              }
                            />
                            <Tooltip
                              formatter={(value) => {
                                const n =
                                  typeof value === 'number'
                                    ? value
                                    : typeof value === 'string'
                                      ? Number.parseFloat(value)
                                      : NaN;
                                return Number.isFinite(n) ? money(n) : '—';
                              }}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="ourPrice"
                              name="Bizim fiyat"
                              stroke="#2563eb"
                              strokeWidth={2}
                              dot={false}
                              connectNulls
                            />
                            <Line
                              type="monotone"
                              dataKey="lowestCompetitor"
                              name="En ucuz rakip"
                              stroke="#dc2626"
                              strokeWidth={2}
                              dot={false}
                              connectNulls
                            />
                            <Line
                              type="monotone"
                              dataKey="avgCompetitor"
                              name="Rakip ortalaması"
                              stroke="#16a34a"
                              strokeWidth={2}
                              strokeDasharray="4 4"
                              dot={false}
                              connectNulls
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tarih</TableHead>
                          <TableHead>Fiyat</TableHead>
                          <TableHead>Değişim %</TableHead>
                          <TableHead>Neden</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyQuery.data.items.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={4}
                              className="text-center text-muted-foreground"
                            >
                              Seçilen dönemde fiyat değişikliği yok.
                            </TableCell>
                          </TableRow>
                        ) : (
                          historyQuery.data.items.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="whitespace-nowrap text-muted-foreground">
                                {format(new Date(row.appliedAt), 'd MMM yyyy HH:mm', {
                                  locale: tr,
                                })}
                              </TableCell>
                              <TableCell>{money(row.price)}</TableCell>
                              <TableCell
                                className={
                                  row.changePct != null && row.changePct < 0
                                    ? 'font-medium text-green-600'
                                    : row.changePct != null && row.changePct > 0
                                      ? 'font-medium text-red-600'
                                      : 'text-muted-foreground'
                                }
                              >
                                {row.changePct == null
                                  ? '—'
                                  : `%${row.changePct.toFixed(1)}`}
                              </TableCell>
                              <TableCell>
                                {SOURCE_LABELS[row.source] ?? row.source}
                                {row.reason && row.reason !== row.source
                                  ? ` · ${row.reason}`
                                  : ''}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="matrix" className="space-y-4">
          {matrixQuery.isLoading ? (
            <TableSkeleton rows={8} cols={5} />
          ) : matrixQuery.isError ? (
            <QueryErrorAlert
              error={matrixQuery.error}
              onRetry={() => {
                void matrixQuery.refetch();
              }}
            />
          ) : (matrixQuery.data?.length ?? 0) === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Rakip fiyat verisi henüz yok.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ürün</TableHead>
                    <TableHead>Barkod</TableHead>
                    <TableHead>Platform fiyatları</TableHead>
                    <TableHead>En ucuz</TableHead>
                    <TableHead className="w-[120px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrixQuery.data?.map((row) => {
                    const cheapestCell = row.platforms.find((p) => p.isCheapest);
                    const matchTarget =
                      row.globalLowest ??
                      cheapestCell?.lowestCompetitor ??
                      null;
                    return (
                      <TableRow key={row.barcode}>
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {row.title}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.barcode}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {row.platforms.map((p: CompetitorMatrixPlatformCell) => (
                              <Badge
                                key={`${row.barcode}-${p.platform}`}
                                variant={p.isCheapest ? 'default' : 'secondary'}
                                className={
                                  p.isCheapest
                                    ? 'bg-green-600 hover:bg-green-600'
                                    : undefined
                                }
                              >
                                {p.platform}: {money(p.ourPrice)}
                                {p.lowestCompetitor != null
                                  ? ` / ${money(p.lowestCompetitor)}`
                                  : ''}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold tabular-nums text-green-700">
                          {money(row.globalLowest)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={matchTarget == null || createRule.isPending}
                            onClick={() => {
                              const first = row.platforms[0];
                              if (first) {
                                handleMatchPrice(
                                  row.barcode,
                                  first.platform,
                                  matchTarget,
                                );
                              }
                            }}
                          >
                            Fiyatı eşitle
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="flex justify-end">
            <Button type="button" onClick={() => setAlertOpen(true)}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Uyarı ekle
            </Button>
          </div>

          {alertsQuery.isLoading ? (
            <TableSkeleton rows={4} cols={5} />
          ) : alertsQuery.isError ? (
            <QueryErrorAlert
              error={alertsQuery.error}
              onRetry={() => {
                void alertsQuery.refetch();
              }}
            />
          ) : (
            <>
              {(alertsQuery.data?.triggered.length ?? 0) > 0 ? (
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base text-amber-900">
                      <AlertTriangle className="h-4 w-4" aria-hidden />
                      Eşik altındaki fiyatlar ({alertsQuery.data?.triggered.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {alertsQuery.data?.triggered.map((a) => (
                      <div
                        key={a.alertId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">{a.title}</p>
                          <p className="text-muted-foreground">
                            {a.barcode} · {a.platform}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-red-600">
                            {money(a.currentPrice)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Eşik: {money(a.thresholdPrice)} (−{money(a.gapTry)})
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <p className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  <Bell className="h-4 w-4" aria-hidden />
                  Şu an eşik altına düşen fiyat yok.
                </p>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ürün</TableHead>
                      <TableHead>Güncel</TableHead>
                      <TableHead>Eşik</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead>Bildirim</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(alertsQuery.data?.all.length ?? 0) === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-muted-foreground"
                        >
                          Henüz fiyat uyarısı tanımlanmadı.
                        </TableCell>
                      </TableRow>
                    ) : (
                      alertsQuery.data?.all.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell>
                            <p className="font-medium">{a.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {a.barcode}
                            </p>
                          </TableCell>
                          <TableCell>{money(a.currentPrice)}</TableCell>
                          <TableCell>{money(a.thresholdPrice)}</TableCell>
                          <TableCell>
                            {a.isTriggered ? (
                              <Badge variant="destructive">Eşik altı</Badge>
                            ) : (
                              <Badge variant="secondary">Normal</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {[
                              a.notifyEmail && 'E-posta',
                              a.notifyInApp && 'Uygulama',
                              a.notifySms && 'SMS',
                            ]
                              .filter(Boolean)
                              .join(', ') || '—'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
        </CardContent>
      </Card>

      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fiyat uyarısı ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="alert-listing">Ürün / listeleme</Label>
              <Select value={alertListingId} onValueChange={setAlertListingId}>
                <SelectTrigger id="alert-listing">
                  <SelectValue placeholder="Listeleme seçin" />
                </SelectTrigger>
                <SelectContent>
                  {(listingsQuery.data?.items ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.title} ({l.platform})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert-threshold">Eşik fiyat (TRY)</Label>
              <Input
                id="alert-threshold"
                type="number"
                min={0}
                step="0.01"
                placeholder="Örn. 499.99"
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Fiyat bu değerin altına düştüğünde uyarı alırsınız.
              </p>
            </div>
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Bildirim kanalları</p>
              <div className="flex items-center justify-between">
                <Label htmlFor="alert-email">E-posta</Label>
                <Switch
                  id="alert-email"
                  checked={alertEmail}
                  onCheckedChange={setAlertEmail}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="alert-inapp">Uygulama içi</Label>
                <Switch
                  id="alert-inapp"
                  checked={alertInApp}
                  onCheckedChange={setAlertInApp}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="alert-sms">SMS</Label>
                <Switch
                  id="alert-sms"
                  checked={alertSms}
                  onCheckedChange={setAlertSms}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAlertOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              disabled={createAlert.isPending || alertListingId === ''}
              onClick={handleCreateAlert}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
