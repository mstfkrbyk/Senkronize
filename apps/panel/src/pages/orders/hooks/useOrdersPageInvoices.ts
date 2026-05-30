import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { InvoiceDto } from '@/types/invoice';

export interface OrderPageInvoiceHint {
  /** Satırda gösterilecek fatura: önce taslak, yoksa en güncel (iptal hariç). */
  invoice: InvoiceDto | null;
}

function pickDisplayInvoice(
  current: InvoiceDto | null,
  candidate: InvoiceDto,
): InvoiceDto {
  if (!current) {
    return candidate;
  }
  if (current.status === 'DRAFT') {
    return current;
  }
  if (candidate.status === 'DRAFT') {
    return candidate;
  }
  return new Date(candidate.createdAt) > new Date(current.createdAt) ? candidate : current;
}

function buildHints(
  items: InvoiceDto[],
  orderIds: readonly string[],
): Map<string, OrderPageInvoiceHint> {
  const idSet = new Set(orderIds);
  const map = new Map<string, OrderPageInvoiceHint>();

  for (const orderId of orderIds) {
    map.set(orderId, { invoice: null });
  }

  for (const inv of items) {
    if (!inv.orderId || !idSet.has(inv.orderId) || inv.status === 'CANCELLED') {
      continue;
    }
    const entry = map.get(inv.orderId)!;
    entry.invoice = pickDisplayInvoice(entry.invoice, inv);
  }

  return map;
}

export function useOrdersPageInvoices(
  orderIds: readonly string[],
  enabled: boolean,
): {
  hintsByOrderId: Map<string, OrderPageInvoiceHint>;
  isLoading: boolean;
} {
  const orderIdsKey = orderIds.join(',');

  const query = useQuery({
    queryKey: ['invoices', 'orders-page', orderIdsKey],
    enabled: enabled && orderIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<InvoiceDto[]> => {
      const { data } = await api.get<{ items: InvoiceDto[] }>('/invoices', {
        params: {
          orderIds: orderIds.join(','),
          limit: 100,
          page: 1,
        },
      });
      return data.items;
    },
  });

  const hintsByOrderId = useMemo(
    () => buildHints(query.data ?? [], orderIds),
    [query.data, orderIds],
  );

  return {
    hintsByOrderId,
    isLoading: enabled && orderIds.length > 0 && query.isLoading,
  };
}
