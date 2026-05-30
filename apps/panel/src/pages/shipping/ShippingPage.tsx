import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Download,
  Loader2,
  Package,
  Plug,
  Settings,
  TestTube2,
  Trash2,
  Truck,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CargoProvider } from '@senkronize/shared';

import { PageHeader } from '@/components/PageHeader';
import { BulkShipModal } from '@/components/shipping/BulkShipModal';
import { CargoConnectionWizard } from '@/components/shipping/CargoConnectionWizard';
import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActiveNav } from '@/hooks/useActiveNav';
import { useCargoConnections } from '@/hooks/useUnifiedConnections';
import { usePageTitle } from '@/hooks/usePageTitle';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  CONNECTION_STATUS_BADGE,
  CONNECTION_STATUS_LABELS,
  getCargoDisplay,
} from '@/lib/cargo-display';
import { CARGO_PROVIDER_OPTIONS } from '@/lib/cargo-providers';
import {
  isKnownOrderStatus,
  orderStatusLabel,
  orderStatusTone,
} from '@/lib/order-status';
import type { CargoPriceQuote } from '@/types/shipping';
import type { Order } from '@/types/order';

function formatDate(iso: string | null): string {
  if (!iso) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
  }).format(amount);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CargoConnectionsTab(): ReactElement {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const connectionsQuery = useCargoConnections();

  const handleTest = async (connectionId: string): Promise<void> => {
    setTestingId(connectionId);
    try {
      await api.get<CargoPriceQuote[]>('/cargo/compare-prices', {
        params: {
          weight: 1,
          desi: 1,
          fromCity: 'İstanbul',
          toCity: 'Ankara',
        },
      });
      toast.success('Bağlantı testi başarılı — fiyat sorgusu yanıt verdi');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err));
    } finally {
      setTestingId(null);
    }
  };

  if (connectionsQuery.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-36 w-full" />
        ))}
      </div>
    );
  }

  if (connectionsQuery.isError) {
    return (
      <QueryErrorAlert
        error={connectionsQuery.error}
        onRetry={() => {
          void connectionsQuery.refetch();
        }}
      />
    );
  }

  const connections = connectionsQuery.data ?? [];

  if (connections.length === 0) {
    return (
      <>
        <EmptyState
          icon={Truck}
          title="Henüz kargo bağlantısı yok"
          description="Kargo firmalarınızı bağlayarak etiket ve takip işlemlerini otomatikleştirin."
          action={{
            label: 'Kargo Bağla',
            onClick: () => setWizardOpen(true),
          }}
        />
        <CargoConnectionWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          connectedProviders={[]}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" onClick={() => setWizardOpen(true)}>
          <Plug className="mr-2 h-4 w-4" aria-hidden />
          Kargo Bağla
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {connections.map((conn) => {
          const display = getCargoDisplay(conn.platform);
          const statusClass =
            CONNECTION_STATUS_BADGE[conn.status] ?? CONNECTION_STATUS_BADGE.unknown;
          return (
            <Card key={conn.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                  <span className="text-3xl" aria-hidden>
                    {display.logo}
                  </span>
                  <div>
                    <CardTitle className="text-base">{display.label}</CardTitle>
                    <CardDescription className="text-xs">
                      Son kullanım: {formatDate(conn.lastSyncAt)}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className={statusClass}>
                  {CONNECTION_STATUS_LABELS[conn.status] ?? conn.status}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={testingId === conn.id}
                  onClick={() => void handleTest(conn.id)}
                >
                  {testingId === conn.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <TestTube2 className="mr-1 h-4 w-4" aria-hidden />
                  )}
                  Test et
                </Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link to="/connections?tab=cargo">
                    <Settings className="mr-1 h-4 w-4" aria-hidden />
                    Ayarlar
                  </Link>
                </Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link
                    to="/connections?tab=cargo"
                    title="Kargo bağlantısını Entegrasyonlar sayfasındaki Kargo sekmesinden kaldırın"
                  >
                    <Trash2 className="mr-1 h-4 w-4" aria-hidden />
                    Entegrasyonlarda kaldır
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <CargoConnectionWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        connectedProviders={connections.map((c) => c.platform)}
      />
    </>
  );
}

function CargoCompareTab(): ReactElement {
  const [desi, setDesi] = useState('1');
  const [toCity, setToCity] = useState('Ankara');
  const [fromCity] = useState('İstanbul');
  const [submitted, setSubmitted] = useState(false);

  const compareQuery = useQuery({
    queryKey: ['cargo', 'compare-prices', desi, fromCity, toCity],
    queryFn: async (): Promise<CargoPriceQuote[]> => {
      const weight = Math.max(0.1, Number(desi) || 1);
      const { data } = await api.get<CargoPriceQuote[]>('/cargo/compare-prices', {
        params: {
          weight,
          desi: weight,
          fromCity,
          toCity: toCity.trim(),
        },
      });
      return data.map((row) => ({
        ...row,
        providerLabel: getCargoDisplay(row.provider).label,
      }));
    },
    enabled: submitted && toCity.trim().length > 0,
  });

  const rows = compareQuery.data ?? [];
  const cheapestId =
    rows.length > 0
      ? rows.reduce((a, b) => (a.price <= b.price ? a : b)).connectionId ?? rows[0]?.provider
      : null;
  const fastestId =
    rows.length > 0
      ? rows.reduce((a, b) => {
          const da = a.estimatedDays ?? 99;
          const db = b.estimatedDays ?? 99;
          return da <= db ? a : b;
        }).connectionId ?? rows[0]?.provider
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kargo karşılaştırma</CardTitle>
        <CardDescription>
          Desi ve varış şehrine göre bağlı firmalardan fiyat teklifi alın.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="compare-desi">Desi / Ağırlık (kg)</Label>
            <Input
              id="compare-desi"
              type="number"
              min={0.1}
              step={0.1}
              value={desi}
              onChange={(e) => {
                setDesi(e.target.value);
                setSubmitted(false);
              }}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="compare-from">Çıkış şehri</Label>
            <Input id="compare-from" value={fromCity} disabled />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="compare-to">Varış şehri</Label>
            <Input
              id="compare-to"
              value={toCity}
              onChange={(e) => {
                setToCity(e.target.value);
                setSubmitted(false);
              }}
              placeholder="Örn. İzmir"
            />
          </div>
        </div>
        <Button
          type="button"
          onClick={() => setSubmitted(true)}
          disabled={toCity.trim().length === 0}
        >
          Fiyatları getir
        </Button>

        {submitted && compareQuery.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}

        {submitted && compareQuery.isError ? (
          <QueryErrorAlert
            error={compareQuery.error}
            onRetry={() => {
              void compareQuery.refetch();
            }}
          />
        ) : null}

        {submitted && !compareQuery.isPending && !compareQuery.isError && rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aktif kargo bağlantısı bulunamadı veya fiyat alınamadı.
          </p>
        ) : null}

        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead className="text-right">Fiyat</TableHead>
                  <TableHead className="text-right">Tahmini gün</TableHead>
                  <TableHead>Hizmet</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const display = getCargoDisplay(row.provider);
                  const rowKey = row.connectionId ?? row.provider;
                  const isCheapest =
                    (row.connectionId && row.connectionId === cheapestId) ||
                    row.provider === cheapestId;
                  const isFastest =
                    (row.connectionId && row.connectionId === fastestId) ||
                    row.provider === fastestId;
                  return (
                    <TableRow key={rowKey}>
                      <TableCell>
                        <span className="mr-2" aria-hidden>
                          {display.logo}
                        </span>
                        {row.providerLabel ?? display.label}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.price, row.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.estimatedDays != null ? String(row.estimatedDays) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {row.serviceName}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {isCheapest ? (
                            <Badge className="bg-emerald-600">En ucuz</Badge>
                          ) : null}
                          {isFastest ? (
                            <Badge variant="secondary" className="gap-0.5">
                              <Zap className="h-3 w-3" aria-hidden />
                              En hızlı
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function CargoLabelsTab(): ReactElement {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [labelProvider, setLabelProvider] = useState<CargoProvider>('YURTICI');
  const [bulkShipOpen, setBulkShipOpen] = useState(false);

  const ordersQuery = useQuery({
    queryKey: ['orders', 'shipping', 'unshipped'],
    queryFn: async (): Promise<Order[]> => {
      const { data } = await api.get<{ items: Order[]; total: number }>('/orders', {
        params: {
          statuses: 'NEW,PICKING,INVOICED',
          limit: 100,
          page: 1,
        },
      });
      return data.items.filter(
        (o) => !o.cargoTrackingNumber || o.cargoTrackingNumber.trim().length === 0,
      );
    },
  });

  const createLabelsMutation = useMutation({
    mutationFn: async (orderIds: string[]): Promise<void> => {
      for (const orderId of orderIds) {
        await api.post('/cargo/shipments', {
          orderId,
          cargoProvider: labelProvider,
        });
      }
    },
    onSuccess: () => {
      toast.success('Gönderiler oluşturuldu');
      void ordersQuery.refetch();
      setSelectedIds([]);
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const bulkZipMutation = useMutation({
    mutationFn: async (orderIds: string[]): Promise<Blob> => {
      const res = await api.post(
        '/orders/bulk/shipping-labels',
        { orderIds },
        { responseType: 'blob' },
      );
      return res.data as Blob;
    },
    onSuccess: (blob) => {
      downloadBlob(blob, `etiketler-${new Date().toISOString().slice(0, 10)}.zip`);
      toast.success('Etiket ZIP indirildi');
    },
    onError: (err: unknown) => {
      toast.error(getApiErrorMessage(err));
    },
  });

  const orders = ordersQuery.data ?? [];
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedOrders = orders.filter((o) => selectedSet.has(o.id));

  const toggleAll = (checked: boolean): void => {
    setSelectedIds(checked ? orders.map((o) => o.id) : []);
  };

  const toggleOne = (id: string, checked: boolean): void => {
    setSelectedIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Kargo etiketleri</CardTitle>
            <CardDescription>
              Kargo verilmemiş siparişler için etiket oluşturun veya toplu indirin.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Label htmlFor="label-provider" className="text-xs">
                Kargo firması
              </Label>
              <Select
                value={labelProvider}
                onValueChange={(v) => setLabelProvider(v as CargoProvider)}
              >
                <SelectTrigger id="label-provider" className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARGO_PROVIDER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={selectedIds.length === 0 || createLabelsMutation.isPending}
              onClick={() => createLabelsMutation.mutate(selectedIds)}
            >
              {createLabelsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Package className="mr-2 h-4 w-4" aria-hidden />
              )}
              Etiket oluştur
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={selectedIds.length === 0 || bulkZipMutation.isPending}
              onClick={() => bulkZipMutation.mutate(selectedIds)}
            >
              {bulkZipMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Download className="mr-2 h-4 w-4" aria-hidden />
              )}
              ZIP indir
            </Button>
            <Button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setBulkShipOpen(true)}
            >
              <Truck className="mr-2 h-4 w-4" aria-hidden />
              Toplu kargoya ver
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {ordersQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : null}

          {ordersQuery.isError ? (
            <QueryErrorAlert
              error={ordersQuery.error}
              onRetry={() => {
                void ordersQuery.refetch();
              }}
            />
          ) : null}

          {!ordersQuery.isLoading && !ordersQuery.isError && orders.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Kargo bekleyen sipariş yok"
              description="Tüm açık siparişlerde takip numarası tanımlı görünüyor."
            />
          ) : null}

          {orders.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          orders.length > 0 && selectedIds.length === orders.length
                        }
                        onCheckedChange={(v) => toggleAll(v === true)}
                        aria-label="Tümünü seç"
                      />
                    </TableHead>
                    <TableHead>Sipariş no</TableHead>
                    <TableHead>Müşteri</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedSet.has(o.id)}
                          onCheckedChange={(v) => toggleOne(o.id, v === true)}
                          aria-label={`${o.platformOrderId} seç`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{o.platformOrderId}</TableCell>
                      <TableCell>{o.customerName}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            isKnownOrderStatus(o.status) ? orderStatusTone(o.status) : undefined
                          }
                        >
                          {orderStatusLabel(o.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/shipping/${o.id}`)}
                        >
                          Detay
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <BulkShipModal
        open={bulkShipOpen}
        onOpenChange={setBulkShipOpen}
        orders={selectedOrders}
        onSuccess={() => {
          void ordersQuery.refetch();
          setSelectedIds([]);
        }}
      />
    </>
  );
}

export function ShippingPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(groupLabel, t('nav.shipping'));
  usePageTitle(t('nav.shipping'));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kargo"
        description="Kargo entegrasyonları ve gönderi yönetimi."
        context={navContextLine}
      />

      <Card>
        <CardContent className="pt-6">
      <Tabs defaultValue="connections">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="connections">Kargo Bağlantıları</TabsTrigger>
          <TabsTrigger value="compare">Kargo Karşılaştırma</TabsTrigger>
          <TabsTrigger value="labels">Kargo Etiketleri</TabsTrigger>
        </TabsList>
        <TabsContent value="connections" className="mt-6">
          <CargoConnectionsTab />
        </TabsContent>
        <TabsContent value="compare" className="mt-6">
          <CargoCompareTab />
        </TabsContent>
        <TabsContent value="labels" className="mt-6">
          <CargoLabelsTab />
        </TabsContent>
      </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
