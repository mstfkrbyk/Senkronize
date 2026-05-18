import type { ReactElement } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { Link } from 'react-router-dom';
import { format } from 'date-fns';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/lib/api';
import { getMarketplaceBranding } from '@/pages/connections/marketplace-display';
import type { StockMovementDto, WarehouseDto } from '@/types/stock';

import {
  useAdjustStock,
  useCreateWarehouse,
  useDeleteWarehouse,
  useSetDefaultWarehouse,
  useStockHistoryOrg,
  useStockOverview,
  useStockSummary,
  useTransferStock,
  useWarehouseStock,
  useWarehouses,
} from './hooks/useStockManagement';

const MOVEMENT_LABELS: Record<string, string> = {
  SALE: 'Satış',
  RETURN: 'İade',
  PURCHASE: 'Satın alma',
  ADJUSTMENT: 'Manuel düzeltme',
  TRANSFER: 'Depo transferi',
  RESERVATION: 'Rezervasyon',
  RESERVATION_RELEASE: 'Rezervasyon iadesi',
  SYNC: 'Senkronizasyon',
};

const MOVEMENT_TYPES = Object.keys(MOVEMENT_LABELS);

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  return {
    from: format(from, 'yyyy-MM-dd'),
    to: format(to, 'yyyy-MM-dd'),
  };
}

function platformLabel(platform: string | null): string {
  if (!platform) {
    return 'Merkezi';
  }
  return getMarketplaceBranding(platform).label;
}

function movementBadgeClass(
  type: string,
  quantity: number,
): string {
  if (type === 'TRANSFER') {
    return 'border-sky-200 bg-sky-50 text-sky-900';
  }
  if (quantity >= 0) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  }
  return 'border-rose-200 bg-rose-50 text-rose-900';
}

interface WarehouseStockCountProps {
  warehouseId: string;
}

function WarehouseStockCount({
  warehouseId,
}: WarehouseStockCountProps): ReactElement {
  const q = useWarehouseStock(warehouseId);
  if (q.isLoading) {
    return <span className="text-muted-foreground text-sm">…</span>;
  }
  if (q.isError) {
    return <span className="text-destructive text-sm">Hata</span>;
  }
  return (
    <span className="text-muted-foreground text-sm">
      {q.data?.length ?? 0} stok satırı
    </span>
  );
}

export function StockManagementPage(): ReactElement {
  usePageTitle('Stok yönetimi');

  const overviewQuery = useStockOverview();
  const warehousesQuery = useWarehouses();

  const [range, setRange] = useState(defaultDateRange);
  const [histType, setHistType] = useState<string>('');
  const [histBarcode, setHistBarcode] = useState('');
  const [histPlatform, setHistPlatform] = useState('');
  const [histPage, setHistPage] = useState(1);
  const histLimit = 20;

  const historyFilters = useMemo(
    () => ({
      from: range.from ? `${range.from}T00:00:00.000Z` : undefined,
      to: range.to ? `${range.to}T23:59:59.999Z` : undefined,
      movementType: histType || undefined,
      barcode: histBarcode.trim() || undefined,
      platform: histPlatform.trim() || undefined,
      page: histPage,
      limit: histLimit,
    }),
    [range.from, range.to, histType, histBarcode, histPlatform, histPage],
  );

  const historyQuery = useStockHistoryOrg(historyFilters);
  const summaryQuery = useStockSummary(
    historyFilters.from ?? '',
    historyFilters.to ?? '',
  );

  const adjustMutation = useAdjustStock();
  const createWhMutation = useCreateWarehouse();
  const transferMutation = useTransferStock();
  const setDefaultMutation = useSetDefaultWarehouse();
  const deleteWhMutation = useDeleteWarehouse();

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustBarcode, setAdjustBarcode] = useState('');
  const [adjustTitle, setAdjustTitle] = useState('');
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustNote, setAdjustNote] = useState('');

  const [whOpen, setWhOpen] = useState(false);
  const [whName, setWhName] = useState('');
  const [whCode, setWhCode] = useState('');
  const [whAddress, setWhAddress] = useState('');

  const [trOpen, setTrOpen] = useState(false);
  const [trFrom, setTrFrom] = useState('');
  const [trTo, setTrTo] = useState('');
  const [trBarcode, setTrBarcode] = useState('');
  const [trQty, setTrQty] = useState(1);

  const openAdjust = useCallback((barcode: string, title: string, qty: number) => {
    setAdjustBarcode(barcode);
    setAdjustTitle(title);
    setAdjustQty(qty);
    setAdjustNote('');
    setAdjustOpen(true);
  }, []);

  const submitAdjust = (): void => {
    adjustMutation.mutate(
      {
        barcode: adjustBarcode,
        newQuantity: adjustQty,
        note: adjustNote || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Stok güncellendi');
          setAdjustOpen(false);
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  const submitWarehouse = (): void => {
    createWhMutation.mutate(
      { name: whName.trim(), code: whCode.trim(), address: whAddress.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Depo eklendi');
          setWhOpen(false);
          setWhName('');
          setWhCode('');
          setWhAddress('');
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  const submitTransfer = (): void => {
    transferMutation.mutate(
      {
        fromWarehouseId: trFrom,
        toWarehouseId: trTo,
        barcode: trBarcode.trim(),
        quantity: trQty,
      },
      {
        onSuccess: () => {
          toast.success('Transfer tamamlandı');
          setTrOpen(false);
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  const exportCsv = (): void => {
    const rows = historyQuery.data?.data ?? [];
    const header = [
      'Tarih',
      'Barkod',
      'Tip',
      'Miktar',
      'Önce',
      'Sonra',
      'Platform',
      'Not',
    ];
    const lines = [
      header.join(';'),
      ...rows.map((r) =>
        [
          r.createdAt,
          r.barcode,
          MOVEMENT_LABELS[r.movementType] ?? r.movementType,
          r.quantity,
          r.beforeQuantity,
          r.afterQuantity,
          r.platform ?? '',
          (r.note ?? '').replaceAll(';', ','),
        ].join(';'),
      ),
    ];
    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stok-hareketleri-${range.from}-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV indirildi');
  };

  const warehouses: WarehouseDto[] = warehousesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Stok yönetimi
          </h1>
          <p className="text-muted-foreground">
            Stok durumu, depolar ve hareket geçmişi tek ekranda.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/stock/count">Stok sayımı</Link>
          </Button>
          <Button variant="outline" onClick={() => setWhOpen(true)}>
            Depo ekle
          </Button>
          <Button variant="outline" onClick={() => setTrOpen(true)}>
            Stok transfer et
          </Button>
        </div>
      </div>

      <Tabs defaultValue="status" className="space-y-4">
        <TabsList>
          <TabsTrigger value="status">Stok durumu</TabsTrigger>
          <TabsTrigger value="warehouses">Depolar</TabsTrigger>
          <TabsTrigger value="history">Hareket geçmişi</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ürün bazlı stok</CardTitle>
              <CardDescription>
                Toplam, rezerve, kullanılabilir ve depo / platform dağılımı.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {overviewQuery.isLoading ? (
                <p className="text-muted-foreground text-sm">Yükleniyor…</p>
              ) : overviewQuery.isError ? (
                <p className="text-destructive text-sm">
                  {getApiErrorMessage(overviewQuery.error)}
                </p>
              ) : (overviewQuery.data?.length ?? 0) === 0 ? (
                <p className="text-muted-foreground text-sm">Kayıt yok.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ürün</TableHead>
                        <TableHead>Barkod</TableHead>
                        <TableHead className="text-right">Toplam</TableHead>
                        <TableHead className="text-right">Rezerve</TableHead>
                        <TableHead className="text-right">Kullanılabilir</TableHead>
                        <TableHead>Platform</TableHead>
                        <TableHead>Depolar</TableHead>
                        <TableHead className="w-[120px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overviewQuery.data?.map((row) => (
                        <TableRow key={row.barcode}>
                          <TableCell className="max-w-[200px]">
                            <div className="font-medium line-clamp-2">
                              {row.productName ?? '—'}
                            </div>
                            {row.sku ? (
                              <div className="text-xs text-muted-foreground">
                                SKU: {row.sku}
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.barcode}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.totalQuantity.toLocaleString('tr-TR')}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.totalReserved.toLocaleString('tr-TR')}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.available.toLocaleString('tr-TR')}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {row.byPlatform.map((p) => (
                                <Badge
                                  key={`${row.barcode}-p-${p.platform ?? 'c'}`}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {platformLabel(p.platform)}:{' '}
                                  {p.quantity.toLocaleString('tr-TR')}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1 text-xs">
                              {row.byWarehouse.map((w) => (
                                <span key={w.warehouseId}>
                                  <span className="font-medium">{w.code}</span>:{' '}
                                  {w.quantity.toLocaleString('tr-TR')}
                                  {w.reservedQty > 0
                                    ? ` (rez: ${w.reservedQty.toLocaleString('tr-TR')})`
                                    : ''}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-end gap-1">
                              {row.lowStock ? (
                                <Badge variant="destructive" className="text-xs">
                                  Düşük stok
                                </Badge>
                              ) : null}
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  openAdjust(
                                    row.barcode,
                                    row.productName ?? row.barcode,
                                    row.totalQuantity,
                                  )
                                }
                              >
                                Manuel düzelt
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warehouses" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {warehousesQuery.isLoading ? (
              <p className="text-muted-foreground text-sm">Yükleniyor…</p>
            ) : (
              warehouses.map((w) => (
                <Card key={w.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{w.name}</CardTitle>
                      {w.isDefault ? (
                        <Badge className="shrink-0 bg-sky-500 text-white hover:bg-sky-500">
                          Varsayılan
                        </Badge>
                      ) : null}
                    </div>
                    <CardDescription className="font-mono text-xs">
                      {w.code}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="text-muted-foreground">
                      {w.address ?? 'Adres girilmemiş.'}
                    </p>
                    <WarehouseStockCount warehouseId={w.id} />
                    <div className="flex flex-wrap gap-2">
                      {!w.isDefault ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={setDefaultMutation.isPending}
                          onClick={() =>
                            setDefaultMutation.mutate(w.id, {
                              onSuccess: () =>
                                toast.success('Varsayılan depo güncellendi'),
                              onError: (e) =>
                                toast.error(getApiErrorMessage(e)),
                            })
                          }
                        >
                          Varsayılan yap
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={deleteWhMutation.isPending}
                        onClick={() =>
                          deleteWhMutation.mutate(w.id, {
                            onSuccess: () => toast.success('Depo silindi'),
                            onError: (e) =>
                              toast.error(getApiErrorMessage(e)),
                          })
                        }
                      >
                        Sil
                      </Button>
                    </div>
                    <Badge variant={w.isActive ? 'secondary' : 'outline'}>
                      {w.isActive ? 'Aktif' : 'Pasif'}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Özet</CardTitle>
              <CardDescription>Seçilen tarih aralığında hareket toplamları</CardDescription>
            </CardHeader>
            <CardContent>
              {summaryQuery.isLoading ? (
                <p className="text-muted-foreground text-sm">Yükleniyor…</p>
              ) : summaryQuery.data ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(summaryQuery.data.byType).map(([k, v]) => (
                    <Badge key={k} variant="outline" className="tabular-nums">
                      {MOVEMENT_LABELS[k] ?? k}: {v.toLocaleString('tr-TR')}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Tarih seçin.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle>Hareketler</CardTitle>
                <CardDescription>Filtreleyin ve CSV olarak dışa aktarın</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={exportCsv}
                disabled={
                  !historyQuery.data?.data ||
                  historyQuery.data.data.length === 0
                }
              >
                CSV indir
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label htmlFor="h-from">Başlangıç</Label>
                  <Input
                    id="h-from"
                    type="date"
                    value={range.from}
                    onChange={(e) => {
                      setHistPage(1);
                      setRange((r) => ({ ...r, from: e.target.value }));
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="h-to">Bitiş</Label>
                  <Input
                    id="h-to"
                    type="date"
                    value={range.to}
                    onChange={(e) => {
                      setHistPage(1);
                      setRange((r) => ({ ...r, to: e.target.value }));
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Hareket tipi</Label>
                  <Select
                    value={histType || '__all__'}
                    onValueChange={(v) => {
                      setHistPage(1);
                      setHistType(v === '__all__' ? '' : v);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tümü" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tümü</SelectItem>
                      {MOVEMENT_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {MOVEMENT_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="h-barcode">Barkod</Label>
                  <Input
                    id="h-barcode"
                    placeholder="Ara…"
                    value={histBarcode}
                    onChange={(e) => {
                      setHistPage(1);
                      setHistBarcode(e.target.value);
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1 sm:max-w-xs">
                <Label htmlFor="h-platform">Platform kodu (opsiyonel)</Label>
                <Input
                  id="h-platform"
                  placeholder="örn. TRENDYOL"
                  value={histPlatform}
                  onChange={(e) => {
                    setHistPage(1);
                    setHistPlatform(e.target.value);
                  }}
                />
              </div>

              {historyQuery.isLoading ? (
                <p className="text-muted-foreground text-sm">Yükleniyor…</p>
              ) : historyQuery.isError ? (
                <p className="text-destructive text-sm">
                  {getApiErrorMessage(historyQuery.error)}
                </p>
              ) : (historyQuery.data?.data.length ?? 0) === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Bu filtrelere uygun hareket yok.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tarih</TableHead>
                          <TableHead>Barkod</TableHead>
                          <TableHead>Tip</TableHead>
                          <TableHead className="text-right">Miktar</TableHead>
                          <TableHead className="text-right">Önce</TableHead>
                          <TableHead className="text-right">Sonra</TableHead>
                          <TableHead>Platform</TableHead>
                          <TableHead>Açıklama</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyQuery.data?.data.map((r: StockMovementDto) => (
                          <TableRow key={r.id}>
                            <TableCell className="whitespace-nowrap text-sm">
                              {format(new Date(r.createdAt), 'dd.MM.yyyy HH:mm')}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {r.barcode}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={movementBadgeClass(
                                  r.movementType,
                                  r.quantity,
                                )}
                              >
                                {MOVEMENT_LABELS[r.movementType] ??
                                  r.movementType}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {r.quantity > 0 ? '+' : ''}
                              {r.quantity.toLocaleString('tr-TR')}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {r.beforeQuantity.toLocaleString('tr-TR')}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {r.afterQuantity.toLocaleString('tr-TR')}
                            </TableCell>
                            <TableCell className="text-sm">
                              {r.platform
                                ? platformLabel(r.platform)
                                : '—'}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                              {r.note ?? '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-muted-foreground text-sm">
                      Toplam {historyQuery.data?.total.toLocaleString('tr-TR')}{' '}
                      kayıt
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={histPage <= 1}
                        onClick={() => setHistPage((p) => Math.max(1, p - 1))}
                      >
                        Önceki
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          (historyQuery.data?.data.length ?? 0) < histLimit
                        }
                        onClick={() => setHistPage((p) => p + 1)}
                      >
                        Sonraki
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manuel stok düzeltmesi</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{adjustTitle}</p>
            <p className="font-mono text-xs">{adjustBarcode}</p>
            <div className="space-y-1">
              <Label htmlFor="adj-qty">Yeni miktar (ana depo, merkezi stok)</Label>
              <Input
                id="adj-qty"
                type="number"
                min={0}
                value={adjustQty}
                onChange={(e) => setAdjustQty(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="adj-note">Not</Label>
              <Textarea
                id="adj-note"
                rows={3}
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              İptal
            </Button>
            <Button onClick={submitAdjust} disabled={adjustMutation.isPending}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={whOpen} onOpenChange={setWhOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni depo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="wh-name">Ad</Label>
              <Input
                id="wh-name"
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wh-code">Kod</Label>
              <Input
                id="wh-code"
                value={whCode}
                onChange={(e) => setWhCode(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wh-addr">Adres (opsiyonel)</Label>
              <Textarea
                id="wh-addr"
                rows={2}
                value={whAddress}
                onChange={(e) => setWhAddress(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhOpen(false)}>
              İptal
            </Button>
            <Button
              onClick={submitWarehouse}
              disabled={
                createWhMutation.isPending ||
                !whName.trim() ||
                !whCode.trim()
              }
            >
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={trOpen} onOpenChange={setTrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stok transferi</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Yalnızca merkezi stok (platform = merkezi) satırları taşınır.
          </p>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Kaynak depo</Label>
              <Select value={trFrom} onValueChange={setTrFrom}>
                <SelectTrigger>
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Hedef depo</Label>
              <Select value={trTo} onValueChange={setTrTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Seçin" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name} ({w.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="tr-bc">Barkod</Label>
              <Input
                id="tr-bc"
                value={trBarcode}
                onChange={(e) => setTrBarcode(e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="tr-qty">Miktar</Label>
              <Input
                id="tr-qty"
                type="number"
                min={1}
                value={trQty}
                onChange={(e) => setTrQty(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrOpen(false)}>
              İptal
            </Button>
            <Button
              onClick={submitTransfer}
              disabled={
                transferMutation.isPending ||
                !trFrom ||
                !trTo ||
                !trBarcode.trim()
              }
            >
              Transfer et
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
