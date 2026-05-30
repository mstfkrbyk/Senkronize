import { AccountingMode, OrderStatus } from '@prisma/client';

import { resolveOrganizationAccountingMode } from '../common/accounting-mode';

const AUTO_INVOICE_TRIGGER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  OrderStatus.SHIPPED,
  OrderStatus.DELIVERED,
]);

/** Kargoya verildi veya teslim edildi geçişinde otomatik fatura tetiklenir */
export function shouldTriggerOrderAutoInvoice(
  autoInvoice: boolean,
  prevStatus: OrderStatus,
  newStatus: OrderStatus,
): boolean {
  if (!autoInvoice || prevStatus === newStatus) {
    return false;
  }
  return AUTO_INVOICE_TRIGGER_STATUSES.has(newStatus);
}

/** NATIVE muhasebe modunda platform webhook durum güncellemesi otomatik fatura tetiklemez */
export function shouldTriggerOrderAutoInvoiceFromPlatformWebhook(
  accountingMode: AccountingMode | null,
  activeErpCount: number,
  autoInvoice: boolean,
  prevStatus: OrderStatus,
  newStatus: OrderStatus,
): boolean {
  const mode = resolveOrganizationAccountingMode(accountingMode, activeErpCount);
  if (mode === AccountingMode.NATIVE) {
    return false;
  }
  return shouldTriggerOrderAutoInvoice(autoInvoice, prevStatus, newStatus);
}
