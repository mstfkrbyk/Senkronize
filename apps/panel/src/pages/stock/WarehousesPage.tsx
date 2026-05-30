import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  MapPin,
  Package,
  Pencil,
  TrendingDown,
  Warehouse,
} from 'lucide-react';

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
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Textarea } from '@/components/ui/textarea';
import { usePageTitle } from '@/hooks/usePageTitle';

import { StockPageHeader } from './StockPageHeader';
import { getApiErrorMessage } from '@/lib/api';
import type { StockOverviewRow, WarehouseDto } from '@/types/stock';

import { useProductCostMap } from './hooks/useProductCostMap';
import {
  useCreateWarehouse,
  useStockHistoryOrg,
  useStockOverview,
  useUpdateWarehouse,
  useWarehouses,
} from './hooks/useStockManagement';
import {
  movementBadgeClass,
} from './stock-movement-labels';

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

interface ProductRow {
  barcode: string;
  name: string;
  sku: string | null;
  quantity: number;
  value: number;
}

function productsInWarehouse(
  rows: StockOverviewRow[],
  warehouseId: string,
  costMap: Map<string, number>,
): ProductRow[] {
  const list: ProductRow[] = [];
  for (const row of rows) {
    const wh = row.byWarehouse.find((w) => w.warehouseId === warehouseId);
    if (!wh || wh.quantity <= 0) {
      continue;
    }
    const cost = costMap.get(row.barcode) ?? 0;
    list.push({
      barcode: row.barcode,
      name: row.productName ?? row.barcode,
      sku: row.sku,
      quantity: wh.quantity,
      value: wh.quantity * cost,
    });
  }
  return list.sort((a, b) => b.quantity - a.quantity);
}

interface WarehouseFormState {
  name: string;
  address: string;
  description: string;
  isActive: boolean;
}

const EMPTY_FORM: WarehouseFormState = {
  name: '',
  address: '',
  description: '',
  isActive: true,
};

export function WarehousesPage(): ReactElement {
  usePageTitle('Depolar');

  const warehousesQuery = useWarehouses();
  const overviewQuery = useStockOverview();
  const costMapQuery = useProductCostMap();
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse();

  const [whOpen, setWhOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<WarehouseFormState>(EMPTY_FORM);
  const [detailId, setDetailId] = useState<string | null>(null);

  const costMap = useMemo(
    () => costMapQuery.data ?? new Map<string, number>(),
    [costMapQuery.data],
  );
  const overview = useMemo(
    () => overviewQuery.data ?? [],
    [overviewQuery.data],
  );
  const warehouses: WarehouseDto[] = useMemo(
    () => warehousesQuery.data ?? [],
    [warehousesQuery.data],
  );

  const orgTotalQty = useMemo(
    () => overview.reduce((s, r) => s + r.totalQuantity, 0),
    [overview],
  );

  const detailWarehouse = warehouses.find((w) => w.id === detailId);

  const detailStats = useMemo(() => {
    if (!detailId) {
      return null;
    }
    return computeWarehouseStats(overview, detailId, costMap);
  }, [detailId, overview, costMap]);

  const detailProducts = useMemo(() => {
    if (!detailId) {
      return [];
    }
    return productsInWarehouse(overview, detailId, costMap);
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

  const detailMovementsQuery = useStockHistoryOrg({
    warehouseId: detailId ?? undefined,
    limit: 8,
    page: 1,
  });

  const occupancyPercent = useMemo(() => {
    if (!detailStats || orgTotalQty <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((detailStats.totalQty / orgTotalQty) * 100));
  }, [detailStats, orgTotalQty]);

  const openCreate = (): void => {
    setEditId(null);
    setForm(EMPTY_FORM);
    setWhOpen(true);
  };

  const openEdit = (w: WarehouseDto): void => {
    setEditId(w.id);
    setForm({
      name: w.name,
      address: w.address?.split('\n')[0] ?? '',
      description: w.address?.split('\n').slice(1).join('\n') ?? '',
      isActive: w.isActive,
    });
    setWhOpen(true);
  };

  const submitWarehouse = (): void => {
    const name = form.name.trim();
    if (!name) {
      toast.error('Depo adı gerekli.');
      return;
    }
    const addressParts = [form.address.trim(), form.description.trim()].filter(
      (p) => p.length > 0,
    );
    const address = addressParts.length > 0 ? addressParts.join('\n') : undefined;

    if (editId) {
      updateMutation.mutate(
        { id: editId, name, address, isActive: form.isActive },
        {
          onSuccess: () => {
            toast.success('Depo güncellendi');
            setWhOpen(false);
            setEditId(null);
            setForm(EMPTY_FORM);
          },
          onError: (e) => toast.error(getApiErrorMessage(e)),
        },
      );
      return;
    }

    createMutation.mutate(
      { name, code: slugCode(name), address },
      {
        onSuccess: () => {
          toast.success('Depo oluşturuldu');
          setWhOpen(false);
          setForm(EMPTY_FORM);
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  return (
    <div className="space-y-6">
      <StockPageHeader
        title="Depolar"
        description="Stok lokasyonlarınızı yönetin."
        actions={<Button onClick={openCreate}>Depo ekle</Button>}
      />

      <Card>
        <CardContent className="pt-6">
      {warehousesQuery.isLoading ? (
        <p className="text-muted-foreground text-sm">Yükleniyor…</p>
      ) : warehouses.length === 0 ? (
          <p className="py-10 text-center text-muted-foreground text-sm">
            Henüz depo tanımlı değil. İlk deponuzu oluşturun.
          </p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-md border md:hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Depo</TableHead>
                  <TableHead className="text-right">Ürün</TableHead>
                  <TableHead className="text-right">Değer</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {warehouses.map((w) => {
                  const stats = computeWarehouseStats(overview, w.id, costMap);
                  return (
                    <TableRow
                      key={w.id}
                      className="cursor-pointer"
                      onClick={() => setDetailId(w.id)}
                    >
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {stats.productCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {stats.totalValue > 0
                          ? `${stats.totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={w.isActive ? 'secondary' : 'outline'}>
                          {w.isActive ? 'Aktif' : 'Pasif'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
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
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {w.isDefault ? (
                          <Badge className="bg-sky-500 text-white hover:bg-sky-500">
                            Varsayılan
                          </Badge>
                        ) : null}
                        <Badge variant={w.isActive ? 'secondary' : 'outline'}>
                          {w.isActive ? 'Aktif' : 'Pasif'}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription className="flex items-start gap-1">
                      <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden />
                      {w.address ?? 'Konum girilmemiş'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Ürün sayısı</p>
                        <p className="font-medium tabular-nums">
                          {stats.productCount.toLocaleString('tr-TR')}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Toplam stok değeri</p>
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
                        <Link to={`/stock?warehouse=${w.id}`}>Stok görüntüle</Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(w);
                        }}
                      >
                        <Pencil className="mr-1 size-3.5" />
                        Düzenle
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
        </CardContent>
      </Card>

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
                      Ürün sayısı
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

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Doluluk oranı</span>
                  <span className="text-muted-foreground tabular-nums">
                    %{occupancyPercent} (org. stok payı)
                  </span>
                </div>
                <Progress value={occupancyPercent} className="h-2" />
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Ürün listesi</h3>
                {detailProducts.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Kayıt yok.</p>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ürün</TableHead>
                          <TableHead className="text-right">Adet</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailProducts.slice(0, 20).map((row) => (
                          <TableRow key={row.barcode}>
                            <TableCell className="max-w-[160px]">
                              <div className="line-clamp-2 text-sm font-medium">
                                {row.name}
                              </div>
                              <div className="font-mono text-xs text-muted-foreground">
                                {row.sku ?? row.barcode}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.quantity.toLocaleString('tr-TR')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium">Son hareketler</h3>
                {detailMovementsQuery.isLoading ? (
                  <p className="text-muted-foreground text-sm">Yükleniyor…</p>
                ) : (detailMovementsQuery.data?.data.length ?? 0) === 0 ? (
                  <p className="text-muted-foreground text-sm">Hareket yok.</p>
                ) : (
                  <ul className="space-y-2">
                    {detailMovementsQuery.data?.data.map((mv) => (
                      <li
                        key={mv.id}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs">{mv.barcode}</p>
                          <p className="text-muted-foreground text-xs">
                            {format(new Date(mv.createdAt), 'dd.MM.yyyy HH:mm')}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={movementBadgeClass(mv.movementType, mv.quantity)}
                        >
                          {mv.quantity > 0 ? '+' : ''}
                          {mv.quantity.toLocaleString('tr-TR')}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  type="button"
                  variant="link"
                  className="mt-2 h-auto px-0"
                  asChild
                >
                  <Link to={`/stock/movements?warehouse=${detailWarehouse.id}`}>
                    Tüm hareketleri gör
                  </Link>
                </Button>
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

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => openEdit(detailWarehouse)}
                >
                  Depoyu düzenle
                </Button>
                <Button asChild className="flex-1">
                  <Link to={`/stock?warehouse=${detailWarehouse.id}`}>
                    Stok listesi
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog
        open={whOpen}
        onOpenChange={(open) => {
          setWhOpen(open);
          if (!open) {
            setEditId(null);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? 'Depo düzenle' : 'Yeni depo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="wh-name">İsim</Label>
              <Input
                id="wh-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ör. Ana depo"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wh-addr">Konum / adres</Label>
              <Textarea
                id="wh-addr"
                rows={2}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wh-desc">Açıklama</Label>
              <Textarea
                id="wh-desc"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            {editId ? (
              <div className="space-y-1">
                <Label>Durum</Label>
                <Select
                  value={form.isActive ? 'active' : 'inactive'}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, isActive: v === 'active' }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Aktif</SelectItem>
                    <SelectItem value="inactive">Pasif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWhOpen(false)}>
              İptal
            </Button>
            <Button
              onClick={submitWarehouse}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                !form.name.trim()
              }
            >
              {editId ? 'Kaydet' : 'Oluştur'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
