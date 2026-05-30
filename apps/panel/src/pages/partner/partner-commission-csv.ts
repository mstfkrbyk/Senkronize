import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

import type { CommissionEntry } from '@/types/partner';

import {
  commissionLedgerStatusLabel,
  commissionTypeLabel,
} from './partner-commission-labels';
import { formatTryPlain } from './partner-utils';

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

const CSV_HEADERS = [
  'Tarih',
  'Müşteri',
  'Miktar (TRY)',
  'Tür',
  'Durum',
  'Açıklama',
] as const;

export function buildPartnerCommissionHistoryCsv(rows: CommissionEntry[]): string {
  const lines = rows.map((row) => {
    const date = format(new Date(row.createdAt), 'yyyy-MM-dd HH:mm', { locale: tr });
    const client = row.clientOrg?.name ?? '—';
    const amountRaw = Number(row.amount);
    const amount = Number.isFinite(amountRaw)
      ? formatTryPlain(amountRaw)
      : '—';
    const type = commissionTypeLabel(row.type);
    const status = commissionLedgerStatusLabel(row.status);
    const desc = row.description ?? '';
    return [date, client, amount, type, status, desc]
      .map((c) => escapeCsvCell(String(c)))
      .join(',');
  });
  return [CSV_HEADERS.map(escapeCsvCell).join(','), ...lines].join('\n');
}

export function downloadPartnerCommissionHistoryCsv(
  rows: CommissionEntry[],
  page: number,
): void {
  const csv = '\uFEFF' + buildPartnerCommissionHistoryCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `komisyon-gecmisi-sayfa-${page}.csv`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
