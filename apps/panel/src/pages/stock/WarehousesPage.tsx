import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { MapPin, Package, TrendingDown, Warehouse } from 'lucide-react';

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
  Sheet,
  SheetContent,
  SheetDescription,
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
import { Textarea } from '@/components/ui/textarea';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/lib/api';
import type { StockOverviewRow, WarehouseDto } from '@/types/stock';

import { useProductCostMap } from './hooks/useProductCostMap';
import {
  useCreateWarehouse,
  useDailyMovementFlow,
  useStockOverview,
  useWarehouses,
} from './hooks/useStockManagement';

function slugCode(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return base.length > 0 ? base : `DEPO-${Date.now().toString(36).toUpperCase()}`;
}

interface WarehouseStats {
  productCount: number;
  totalQty: number;
  totalValue: number;
}

function computeWarehouseStats(
  rows: StockOverviewRow[],
  warehouseId: string,
  costMap: Map<string, number>,
): WarehouseStats {
  let productCount = 0;
  let totalQty = 0;
  let totalValue = 0;
  for (const row of rows) {
    const wh = row.byWarehouse.find((w) => w.warehouseId === warehouseId);
    if (!wh || wh.quantity <= 0) {
      continue;
    }
    productCount += 1;
    totalQty += wh.quantity;
    const cost = costMap.get(row.barcode) ?? 0;
    totalValue += wh.quantity * cost;
  }
  return { productCount, totalQty, totalValue };
}

interface TopProductRow {
  barcode: string;
  name: string;
  quantity: number;
  value: number;
}

function topProductsByValue(
  rows: StockOverviewRow[],
  warehouseId: string,
  costMap: Map<string, number>,
  limit = 10,
): TopProductRow[] {
  const list: TopProductRow[] = [];
  for (const row of rows) {
    const wh = row.byWarehouse.find((w) => w.warehouseId === warehouseId);
    if (!wh) {
      continue;
    }
    const cost = costMap.get(row.barcode) ?? 0;
    list.push({
      barcode: row.barcode,
      name: row.productName ?? row.barcode,
      quantity: wh.quantity,
      value: wh.quantity * cost,
    });
  }
  return list
    .sort((a, b) => b.value - a.value || b.quantity - a.quantity)
    .slice(0, limit);
}

export function WarehousesPage(): ReactElement {
  usePageTitle('Depo yönetimi');

  const warehousesQuery = useWarehouses();
  const overviewQuery = useStockOverview();
  const costMapQuery = useProductCostMap();
  const flowQuery = useDailyMovementFlow(7);
  const createMutation = useCreateWarehouse();

  const [whOpen, setWhOpen] = useState(false);
  const [whName, setWhName] = useState('');
  const [whAddress, setWhAddress] = useState('');
  const [whDescription, setWhDescription] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const costMap = costMapQuery.data ?? new Map<string, number>();
  const overview = overviewQuery.data ?? [];
  const warehouses: WarehouseDto[] = warehousesQuery.data ?? [];

  const detailWarehouse = warehouses.find((w) => w.id === detailId);

  const detailStats = useMemo(() => {
    if (!detailId) {
      return null;
    }
    return computeWarehouseStats(overview, detailId, costMap);
  }, [detailId, overview, costMap]);

  const detailTop = useMemo(() => {
    if (!detailId) {
      return [];
    }
    return topProductsByValue(overview, detailId, costMap);
  }, [detailId, overview, costMap]);

  const detailLowStock = useMemo(() => {
    if (!detailId) {
      return [];
    }
    return overview.filter((row) => {
      const wh = row.byWarehouse.find((w) => w.warehouseId === detailId);
      return wh !== undefined && row.lowStock;
    });
  }, [detailId, overview]);

  const submitWarehouse = (): void => {
    const name = whName.trim();
    if (!name) {
      toast.error('Depo adı gerekli.');
      return;
    }
    const addressParts = [whAddress.trim(), whDescription.trim()].filter(
      (p) => p.length > 0,
    );
    createMutation.mutate(
      {
        name,
        code: slugCode(name),
        address: addressParts.length > 0 ? addressParts.join('\n') : undefined,
      },
      {
        onSuccess: () => {
          toast.success('Depo oluşturuldu');
          setWhOpen(false);
          setWhName('');
          setWhAddress('');
          setWhDescription('');
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  const flowSummary = useMemo(() => {
    const points = flowQuery.data ?? [];
    let inflow = 0;
    let outflow = 0;
    for (const p of points) {
      inflow += p.inflow;
      outflow += p.outflow;
    }
    return { inflow, outflow };
  }, [flowQuery.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-primary">
            Depo yönetimi
          </h1>
          <p className="text-muted-foreground">
            Depolarınızı yönetin, stok dağılımını ve hareket özetini görün.
          </p>
        </div>
        <Button onClick={() => setWhOpen(true)}>Yeni Depo</Button>
      </div>

      {warehousesQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Yükleniyor…</p>
      ) : warehouses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Henüz depo tanımlı değil. İlk deponuzu oluşturun.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((w) => {
            const stats = computeWarehouseStats(overview, w.id, costMap);
            return (
              <Card
                key={w.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => setDetailId(w.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Warehouse className="size-4 text-sky-500" aria-hidden />
                      {w.name}
                    </CardTitle>
                    {w.isDefault ? (
                      <Badge className="shrink-0 bg-sky-500 text-white hover:bg-sky-500">
                        Varsayılan
                      </Badge>
                    ) : null}
                  </div>
                  <CardDescription className="flex items-start gap-1">
                    <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden />
                    {w.address ?? 'Konum girilmemiş'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Ürün</p>
                      <p className="font-medium tabular-nums">
                        {stats.productCount.toLocaleString('tr-TR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Stok değeri</p>
                      <p className="font-medium tabular-nums">
                        {stats.totalValue > 0
                          ? `${stats.totalValue.toLocaleString('tr-TR', {
                              maximumFractionDigits: 0,
                            })} ₺`
                          : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      asChild
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link to={`/stock?warehouse=${w.id}`}>Stok Görüntüle</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailId(w.id);
                      }}
                    >
                      Detay
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={detailId !== null} onOpenChange={(o) => !o && setDetailId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{detailWarehouse?.name ?? 'Depo detayı'}</SheetTitle>
            <SheetDescription>
              {detailWarehouse?.address ?? 'Adres yok'}
            </SheetDescription>
          </SheetHeader>
          {detailWarehouse && detailStats ? (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardHeader className="pb-1">
                    <CardDescription className="flex items-center gap-1">
                      <Package className="size-3" aria-hidden />
                      Toplam ürün
                    </CardDescription>
                    <CardTitle className="text-xl tabular-nums">
                      {detailStats.productCount.toLocaleString('tr-TR')}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card>
                  <CardHeader className="pb-1">
                    <CardDescription>Stok değeri</CardDescription>
                    <CardTitle className="text-xl tabular-nums">
                      {detailStats.totalValue > 0
                        ? `${detailStats.totalValue.toLocaleString('tr-TR', {
                            maximumFractionDigits: 0,
                          })} ₺`
                        : '—'}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">
                  Stok hareket özeti (son 7 gün)
                </h3>
                {flowQuery.isLoading ? (
                  <p className="text-muted-foreground text-sm">Yükleniyor…</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="tabular-nums">
                      Giriş: {flowSummary.inflow.toLocaleString('tr-TR')}
                    </Badge>
                    <Badge variant="outline" className="tabular-nums">
                      Çıkış: {flowSummary.outflow.toLocaleString('tr-TR')}
                    </Badge>
                  </div>
                )}
                <p className="mt-1 text-muted-foreground text-xs">
                  Organizasyon geneli; depo bazlı ayrım yakında.
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">
                  En değerli 10 ürün
                </h3>
                {detailTop.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Kayıt yok.</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ürün</TableHead>
                          <TableHead className="text-right">Adet</TableHead>
                          <TableHead className="text-right">Değer</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailTop.map((row) => (
                          <TableRow key={row.barcode}>
                            <TableCell className="max-w-[160px]">
                              <div className="line-clamp-2 text-sm font-medium">
                                {row.name}
                              </div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {row.barcode}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.quantity.toLocaleString('tr-TR')}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.value > 0
                                ? `${row.value.toLocaleString('tr-TR', {
                                    maximumFractionDigits: 0,
                                  })} ₺`
                                : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 flex items-center gap-1 text-sm font-medium">
                  <TrendingDown className="size-4 text-amber-600" aria-hidden />
                  Düşük stok uyarıları
                </h3>
                {detailLowStock.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Bu depoda düşük stok uyarısı yok.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detailLowStock.slice(0, 8).map((row) => {
                      const wh = row.byWarehouse.find(
                        (x) => x.warehouseId === detailId,
                      );
                      return (
                        <li
                          key={row.barcode}
                          className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                        >
                          <span className="line-clamp-1">
                            {row.productName ?? row.barcode}
                          </span>
                          <Badge variant="destructive" className="tabular-nums">
                            {wh?.quantity.toLocaleString('tr-TR') ?? 0}
                          </Badge>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <Button asChild className="w-full">
                <Link to={`/stock?warehouse=${detailWarehouse.id}`}>
                  Stok listesini aç
                </Link>
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={whOpen} onOpenChange={setWhOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni depo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="wh-name">İsim</Label>
              <Input
                id="wh-name"
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                placeholder="ör. Ana depo"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wh-addr">Adres</Label>
              <Textarea
                id="wh-addr"
                rows={2}
                value={whAddress}
                onChange={(e) => setWhAddress(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wh-desc">Açıklama</Label>
              <Textarea
                id="wh-desc"
                rows={2}
                value={whDescription}
                onChange={(e) => setWhDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhOpen(false)}>
              İptal
            </Button>
            <Button
              onClick={submitWarehouse}
              disabled={createMutation.isPending || !whName.trim()}
            >
              Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
