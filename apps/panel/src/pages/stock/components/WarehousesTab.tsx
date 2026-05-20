import type { ReactElement } from 'react';
import { useState } from 'react';

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Pencil, Trash2, Warehouse } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api';
import type { StockOverviewRow, WarehouseDto } from '@/types/stock';

import { useProductCostMap } from '../hooks/useProductCostMap';
import {
  useCreateWarehouse,
  useDeleteWarehouse,
  useStockOverview,
  useUpdateWarehouse,
  useWarehouses,
} from '../hooks/useStockManagement';

function slugCode(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return base.length > 0 ? base : `DEPO-${Date.now().toString(36).toUpperCase()}`;
}

function warehouseStats(
  rows: StockOverviewRow[],
  warehouseId: string,
  costMap: Map<string, number>,
): { skuCount: number; totalValue: number } {
  let skuCount = 0;
  let totalValue = 0;
  for (const row of rows) {
    const wh = row.byWarehouse.find((w) => w.warehouseId === warehouseId);
    if (!wh || wh.quantity <= 0) {
      continue;
    }
    skuCount += 1;
    totalValue += wh.quantity * (costMap.get(row.barcode) ?? 0);
  }
  return { skuCount, totalValue };
}

function formatTry(amount: number): string {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function WarehousesTab(): ReactElement {
  const { t } = useTranslation();

  const warehousesQuery = useWarehouses();
  const overviewQuery = useStockOverview();
  const costMapQuery = useProductCostMap();
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse();
  const deleteMutation = useDeleteWarehouse();

  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  const overview = overviewQuery.data ?? [];
  const costMap = costMapQuery.data ?? new Map<string, number>();
  const warehouses: WarehouseDto[] = warehousesQuery.data ?? [];

  const openCreate = (): void => {
    setEditId(null);
    setName('');
    setAddress('');
    setOpen(true);
  };

  const openEdit = (w: WarehouseDto): void => {
    setEditId(w.id);
    setName(w.name);
    setAddress(w.address ?? '');
    setOpen(true);
  };

  const submit = (): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(t('stock.warehouses.nameRequired'));
      return;
    }
    if (editId) {
      updateMutation.mutate(
        { id: editId, name: trimmed, address: address.trim() || undefined },
        {
          onSuccess: () => {
            toast.success(t('stock.warehouses.updated'));
            setOpen(false);
          },
          onError: (e) => toast.error(getApiErrorMessage(e)),
        },
      );
      return;
    }
    createMutation.mutate(
      { name: trimmed, code: slugCode(trimmed), address: address.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t('stock.warehouses.created'));
          setOpen(false);
        },
        onError: (e) => toast.error(getApiErrorMessage(e)),
      },
    );
  };

  const loading =
    warehousesQuery.isLoading ||
    overviewQuery.isLoading ||
    costMapQuery.isLoading;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={openCreate}>
          {t('stock.warehouses.new')}
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
      ) : warehouses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('stock.warehouses.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((w) => {
            const stats = warehouseStats(overview, w.id, costMap);
            return (
              <Card key={w.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Warehouse className="size-4 text-sky-500" aria-hidden />
                      {w.name}
                    </CardTitle>
                    {w.isDefault ? (
                      <Badge className="shrink-0 bg-sky-500 text-white hover:bg-sky-500">
                        {t('stock.warehouses.default')}
                      </Badge>
                    ) : null}
                  </div>
                  <CardDescription className="font-mono text-xs">
                    {w.code}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p className="text-muted-foreground">
                    {w.address ?? t('stock.warehouses.noAddress')}
                  </p>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>
                      {t('stock.warehouses.totalSku')}:{' '}
                      <strong className="text-foreground tabular-nums">
                        {stats.skuCount.toLocaleString('tr-TR')}
                      </strong>
                    </span>
                    <span>
                      {t('stock.warehouses.totalValue')}:{' '}
                      <strong className="text-foreground tabular-nums">
                        {stats.totalValue > 0 ? formatTry(stats.totalValue) : '—'}
                      </strong>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(w)}
                    >
                      <Pencil className="mr-1 size-3.5" />
                      {t('common.edit')}
                    </Button>
                    <Button type="button" size="sm" variant="outline" asChild>
                      <Link to={`/stock?tab=status&warehouse=${w.id}`}>
                        {t('stock.warehouses.stockList')}
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      disabled={deleteMutation.isPending || w.isDefault}
                      onClick={() =>
                        deleteMutation.mutate(w.id, {
                          onSuccess: () =>
                            toast.success(t('stock.warehouses.deleted')),
                          onError: (e) => toast.error(getApiErrorMessage(e)),
                        })
                      }
                    >
                      <Trash2 className="mr-1 size-3.5" />
                      {t('common.delete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editId
                ? t('stock.warehouses.editTitle')
                : t('stock.warehouses.newTitle')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="wh-tab-name">{t('stock.warehouses.name')}</Label>
              <Input
                id="wh-tab-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wh-tab-addr">{t('stock.warehouses.address')}</Label>
              <Textarea
                id="wh-tab-addr"
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={
                createMutation.isPending ||
                updateMutation.isPending ||
                !name.trim()
              }
            >
              {editId ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
