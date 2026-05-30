import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
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
import type { WarehouseDto } from '@/types/stock';

import { useNativeInventoryValuationEnabled } from '../hooks/useInventoryValuation';
import { useProductCostMap } from '../hooks/useProductCostMap';
import {
  useCreateWarehouse,
  useDeleteWarehouse,
  useStockOverview,
  useUpdateWarehouse,
  useWarehouses,
} from '../hooks/useStockManagement';
import { WarehouseCard } from './WarehouseCard';

function slugCode(name: string): string {
  const base = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return base.length > 0 ? base : `DEPO-${Date.now().toString(36).toUpperCase()}`;
}

export function WarehousesTab(): ReactElement {
  const { t } = useTranslation();
  const { enabled: useNativeValuation, isLoading: accountingModeLoading } =
    useNativeInventoryValuationEnabled();
  const useFallbackValuation = !accountingModeLoading && !useNativeValuation;

  const warehousesQuery = useWarehouses();
  const overviewQuery = useStockOverview({ enabled: useFallbackValuation });
  const costMapQuery = useProductCostMap({ enabled: useFallbackValuation });
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

  const handleDelete = (id: string): void => {
    deleteMutation.mutate(id, {
      onSuccess: () => toast.success(t('stock.warehouses.deleted')),
      onError: (e) => toast.error(getApiErrorMessage(e)),
    });
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

  const loading = useMemo(() => {
    if (warehousesQuery.isLoading || accountingModeLoading) {
      return true;
    }
    if (useFallbackValuation) {
      return overviewQuery.isLoading || costMapQuery.isLoading;
    }
    return false;
  }, [
    warehousesQuery.isLoading,
    accountingModeLoading,
    useFallbackValuation,
    overviewQuery.isLoading,
    costMapQuery.isLoading,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={openCreate}>
          {t('stock.warehouses.new')}
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
      ) : warehousesQuery.isError ? (
        <p className="text-destructive text-sm">
          {getApiErrorMessage(warehousesQuery.error)}
        </p>
      ) : warehouses.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t('stock.warehouses.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((w) => (
            <WarehouseCard
              key={w.id}
              warehouse={w}
              overview={overview}
              costMap={costMap}
              onEdit={openEdit}
              onDelete={handleDelete}
              deletePending={deleteMutation.isPending}
            />
          ))}
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
