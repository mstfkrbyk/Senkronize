import type { OrderPageInvoiceHint } from '@/pages/orders/hooks/useOrdersPageInvoices';
import type { Order } from '@/types/order';

export type OrderInvoiceLinkFilter = 'all' | 'linked' | 'unlinked';

export function applyOrderInvoiceClientFilter(
  orders: Order[],
  hintsByOrderId: Map<string, OrderPageInvoiceHint>,
  invoiceLink: string,
  invoiceStatus: string,
): Order[] {
  let result = orders;
  if (invoiceLink === 'linked') {
    result = result.filter((o) => hintsByOrderId.get(o.id)?.invoice != null);
  } else if (invoiceLink === 'unlinked') {
    result = result.filter((o) => !hintsByOrderId.get(o.id)?.invoice);
  }
  if (invoiceStatus !== 'all' && invoiceStatus.trim().length > 0) {
    result = result.filter(
      (o) => hintsByOrderId.get(o.id)?.invoice?.status === invoiceStatus,
    );
  }
  return result;
}

export function hasActiveOrderInvoiceFilters(
  invoiceLink: string,
  invoiceStatus: string,
): boolean {
  return invoiceLink !== 'all' || invoiceStatus !== 'all';
}
