import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

import { formatTryPlain, PARTNER_STATUS_LABELS, planLabel } from './partner-utils';
import type { PartnerClientTableRow } from './partner-client-rows';

export type PartnerClientCsvRow = PartnerClientTableRow;

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

const CSV_HEADERS = [
  'Firma',
  'Slug',
  'Plan',
  'Sipariş (30 gün)',
  'Aylık gelir (TRY)',
  'Komisyon %',
  'Komisyon (TRY)',
  'Durum',
  'Kayıt tarihi',
] as const;

export function buildPartnerClientsCsv(rows: PartnerClientCsvRow[]): string {
  const lines = rows.map((r) => {
    const date = r.registeredAt
      ? format(new Date(r.registeredAt), 'yyyy-MM-dd', { locale: tr })
      : '';
    return [
      r.name,
      r.slug,
      planLabel(r.plan),
      String(r.orders30d),
      formatTryPlain(r.monthlyRevenue),
      String(r.commissionPct),
      formatTryPlain(r.commissionAmount),
      PARTNER_STATUS_LABELS[r.status],
      date,
    ]
      .map((c) => escapeCsvCell(String(c)))
      .join(',');
  });
  return [CSV_HEADERS.map(escapeCsvCell).join(','), ...lines].join('\n');
}

export function downloadPartnerClientsCsv(
  rows: PartnerClientCsvRow[],
  fileDate: Date,
): void {
  const csv = '\uFEFF' + buildPartnerClientsCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `musteriler-${format(fileDate, 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
