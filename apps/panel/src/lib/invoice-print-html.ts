import type { Order } from '@/types/order';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(amount: string, currency: string): string {
  const n = Number(amount);
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: currency || 'TRY',
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function buildInvoicePrintDocument(
  order: Order,
  organizationName: string,
  organizationTaxNumber?: string | null,
): string {
  const invoiceNo = `FTR-${order.id.slice(-10).toUpperCase()}`;
  const rows = order.items
    .map(
      (it) => `<tr>
      <td>${escapeHtml(it.productName?.trim() || it.sku)}</td>
      <td>${escapeHtml(it.barcode)}</td>
      <td>${escapeHtml(it.sku)}</td>
      <td class="num">${it.quantity}</td>
      <td class="num">${formatMoney(it.unitPrice, order.currency)}</td>
      <td class="num">${formatMoney(String(Number(it.unitPrice) * it.quantity), order.currency)}</td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Fatura ${escapeHtml(invoiceNo)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 16px; color: #111; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    .muted { color: #555; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background: #f3f3f3; }
    .num { text-align: right; }
    .total td { font-weight: bold; background: #fafafa; }
  </style>
</head>
<body>
  <h1>Satış faturası</h1>
  <p class="muted">${escapeHtml(organizationName)}${
    organizationTaxNumber
      ? ` · VKN/TCKN: ${escapeHtml(organizationTaxNumber)}`
      : ''
  }</p>
  <p class="muted">Fatura no: ${escapeHtml(invoiceNo)} · Tarih: ${escapeHtml(formatDate(order.platformCreatedAt))}</p>
  <p class="muted">Platform: ${escapeHtml(order.platform)} · Sipariş: ${escapeHtml(order.platformOrderId)}</p>
  <p><strong>Alıcı:</strong> ${escapeHtml(order.customerName)}</p>
  <table>
    <thead><tr><th>Ürün</th><th>Barkod</th><th>SKU</th><th class="num">Adet</th><th class="num">Birim</th><th class="num">Tutar</th></tr></thead>
    <tbody>
      ${order.items.length > 0 ? rows : '<tr><td colspan="6">Satır yok</td></tr>'}
      <tr class="total"><td colspan="5" class="num">Genel toplam</td><td class="num">${formatMoney(order.totalAmount, order.currency)}</td></tr>
    </tbody>
  </table>
</body>
</html>`;
}
