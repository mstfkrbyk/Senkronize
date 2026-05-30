import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { api, getApiErrorMessage } from '@/lib/api';
import { ORDER_STATUS_LABEL_TR } from '@/lib/order-status';
import type { InvoiceDto } from '@/types/invoice';
import type { Order, OrdersResponse } from '@/types/order';

import { formatInvoiceAmount } from './invoice-utils';
import {
  InvoiceNativeCreateGate,
  useInvoiceNativeCreateAllowed,
} from './InvoiceNativeCreateGate';
import { invoicesT } from './translations';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedOrderIds: Set<string>;
  onCreated: (invoice: InvoiceDto) => void;
}

export function CreateFromOrderDialog({
  open,
  onOpenChange,
  linkedOrderIds,
  onCreated,
}: Props): ReactElement {
  const queryClient = useQueryClient();
  const { isAllowed } = useInvoiceNativeCreateAllowed();
  const [search, setSearch] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const ordersQuery = useQuery({
    queryKey: ['orders', 'invoice-picker', debouncedSearch],
    enabled: open && isAllowed,
    queryFn: async (): Promise<OrdersResponse> => {
      const { data } = await api.get<OrdersResponse>('/orders', {
        params: {
          page: 1,
          limit: 30,
          search: debouncedSearch.trim() || undefined,
          statuses: 'DELIVERED,INVOICED,SHIPPED',
        },
      });
      return data;
    },
  });

  const orders = useMemo(() => {
    const items = ordersQuery.data?.items ?? [];
    return items.filter((o) => !linkedOrderIds.has(o.id));
  }, [ordersQuery.data?.items, linkedOrderIds]);

  const createMutation = useMutation({
    mutationFn: async (orderId: string): Promise<InvoiceDto> => {
      const { data } = await api.post<{ data: InvoiceDto }>(
        `/invoices/from-order/${orderId}`,
      );
      return data.data;
    },
    onSuccess: (invoice) => {
      toast.success(invoicesT('fromOrder.success'));
      onCreated(invoice);
      onOpenChange(false);
      setSearch('');
      setSelectedOrderId(null);
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      void queryClient.invalidateQueries({ queryKey: ['audit-log', 'erp-invoices'] });
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e));
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setSearch('');
          setSelectedOrderId(null);
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{invoicesT('fromOrder.title')}</DialogTitle>
          <DialogDescription>
            {isAllowed
              ? invoicesT('fromOrder.description')
              : invoicesT('externalErp.pageDescription')}
          </DialogDescription>
        </DialogHeader>
        <InvoiceNativeCreateGate>
          <div className="grid gap-3 py-2">
            <div className="grid gap-2">
              <Label htmlFor="orderSearch">{invoicesT('fromOrder.search')}</Label>
              <Input
                id="orderSearch"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={invoicesT('fromOrder.search')}
              />
            </div>
            {ordersQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : null}
            {ordersQuery.isError ? (
              <p className="text-sm text-destructive">
                {getApiErrorMessage(ordersQuery.error)}
              </p>
            ) : null}
            {ordersQuery.isSuccess && orders.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title={invoicesT('fromOrder.noOrders')}
                description={invoicesT('fromOrder.noOrdersDescription')}
              />
            ) : null}
            {ordersQuery.isSuccess && orders.length > 0 ? (
              <ul className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {orders.map((order: Order) => (
                  <li key={order.id}>
                    <button
                      type="button"
                      className={`flex w-full flex-col gap-0.5 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                        selectedOrderId === order.id
                          ? 'border-primary bg-accent'
                          : 'border-transparent'
                      }`}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      <span className="font-medium text-foreground">
                        {order.platformOrderId} · {order.customerName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {ORDER_STATUS_LABEL_TR[order.status]} ·{' '}
                        {formatInvoiceAmount(order.totalAmount, order.currency)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </InvoiceNativeCreateGate>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isAllowed ? invoicesT('actions.cancel') : invoicesT('externalErp.dialogClose')}
          </Button>
          {isAllowed ? (
            <Button
              disabled={!selectedOrderId || createMutation.isPending}
              onClick={() => {
                if (selectedOrderId) {
                  createMutation.mutate(selectedOrderId);
                }
              }}
            >
              {createMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              {invoicesT('actions.create')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
