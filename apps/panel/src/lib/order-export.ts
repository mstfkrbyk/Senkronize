import type { Order } from '@/types/order';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function downloadOrdersExcel(rows: Order[]): void {
  const headers = [
    'Platform',
    'Sipariş No',
    'Müşteri',
    'Ürün Adedi',
    'Tutar',
    'Para Birimi',
    'Durum',
    'Kargo Firması',
    'Takip No',
    'Tarih',
  ];

  const bodyRows = rows.map((o) => {
    const itemCount = o.items.reduce((sum, item) => sum + item.quantity, 0);
    return [
      o.platform,
      o.platformOrderId,
      o.customerName,
      String(itemCount),
      o.totalAmount,
      o.currency,
      o.status,
      o.cargoProvider ?? '',
      o.cargoTrackingNumber ?? '',
      o.platformCreatedAt,
    ]
      .map((cell) => `<td>${escapeHtml(cell)}</td>`)
      .join('');
  });

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head><body>
<table border="1">
<thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
<tbody>${bodyRows.map((r) => `<tr>${r}</tr>`).join('')}</tbody>
</table>
</body></html>`;

  const blob = new Blob([`\ufeff${html}`], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `siparisler-${new Date().toISOString().slice(0, 10)}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadOrdersCsv(rows: Order[]): void {
  const headers = [
    'platform',
    'siparis_no',
    'musteri',
    'urun_adedi',
    'tutar',
    'para_birimi',
    'durum',
    'kargo_firmasi',
    'takip_no',
    'tarih',
  ];
  const lines = [
    headers.join(','),
    ...rows.map((o) => {
      const itemCount = o.items.reduce((sum, item) => sum + item.quantity, 0);
      return [
        escapeCsvCell(o.platform),
        escapeCsvCell(o.platformOrderId),
        escapeCsvCell(o.customerName),
        escapeCsvCell(String(itemCount)),
        escapeCsvCell(o.totalAmount),
        escapeCsvCell(o.currency),
        escapeCsvCell(o.status),
        escapeCsvCell(o.cargoProvider ?? ''),
        escapeCsvCell(o.cargoTrackingNumber ?? ''),
        escapeCsvCell(o.platformCreatedAt),
      ].join(',');
    }),
  ];
  const blob = new Blob([`\ufeff${lines.join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `siparisler-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
