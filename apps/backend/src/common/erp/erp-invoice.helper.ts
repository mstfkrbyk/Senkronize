import type { ErpInvoiceLine } from '@senkronize/shared';

/** ERP faturasına dönüştürülecek sipariş satırı */
export interface ErpOrderItemForInvoice {
  quantity: number;
  price: number;
  title: string;
  sku?: string;
  taxRate?: number;
}

export interface ErpOrderCustomer {
  name?: string;
  email?: string;
}

/** Sipariş → ERP fatura dönüşüm girdisi */
export interface ErpOrderForInvoice {
  externalId?: string | null;
  currency?: string;
  items: ErpOrderItemForInvoice[];
  customer?: ErpOrderCustomer;
}

/** Paraşüt / BizimHesap gibi API'lerde kullanılan satır gövdesi */
export interface InvoiceLine {
  quantity: number;
  unit_price: number;
  vat_rate: number;
  description: string;
  product_code?: string;
}

export interface VatResult {
  net: number;
  vat: number;
  gross: number;
}

const DEFAULT_VAT_RATE = 20;

export function calculateVat(price: number, vatRate: number): VatResult {
  const rate = Math.max(0, vatRate) / 100;
  const net = Math.round((price / (1 + rate)) * 100) / 100;
  const vat = Math.round((price - net) * 100) / 100;
  return { net, vat, gross: Math.round(price * 100) / 100 };
}

export function formatInvoiceDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function orderToInvoiceLines(
  order: ErpOrderForInvoice,
  defaultVatRate: number = DEFAULT_VAT_RATE,
): ErpInvoiceLine[] {
  return order.items.map((item) => {
    const qty = Math.max(0, item.quantity);
    const unit = Math.max(0, item.price);
    const taxRate = item.taxRate ?? defaultVatRate;
    const lineTotal = Math.round(unit * qty * 100) / 100;
    return {
      description: item.title,
      sku: item.sku,
      quantity: qty,
      unitPrice: unit,
      taxRate,
      total: lineTotal,
    };
  });
}

export function erpInvoiceLinesToApiLines(
  lines: ErpInvoiceLine[],
  defaultVatRate: number = DEFAULT_VAT_RATE,
): InvoiceLine[] {
  return lines.map((line) => ({
    quantity: line.quantity,
    unit_price: line.unitPrice,
    vat_rate: line.taxRate ?? defaultVatRate,
    description: line.description,
    product_code: line.sku,
  }));
}

export function invoiceDueDate(issueDate: Date, days = 7): string {
  const due = new Date(issueDate.getTime() + days * 86_400_000);
  return formatInvoiceDate(due);
}
