import type { CustomerStatementLine } from './customer-statement.types';
import { customersT, statementLineTypeLabel } from './translations';

function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function lineTypeLabel(type: CustomerStatementLine['type']): string {
  return statementLineTypeLabel(type);
}

function formatAmount(n: number): string {
  return n.toFixed(2);
}

export function downloadCustomerStatementCsv(
  customerId: string,
  lines: CustomerStatementLine[],
  summary: { totalDebit: number; totalCredit: number; balance: number },
): void {
  const headers = [
    customersT('statement.table.date'),
    customersT('statement.table.type'),
    customersT('statement.table.description'),
    customersT('statement.table.debit'),
    customersT('statement.table.credit'),
    customersT('statement.table.balance'),
  ];

  const rows = lines.map((line) => {
    const iso = line.type === 'PAYMENT' ? (line.paidAt ?? line.date) : line.date;
    const date = iso.slice(0, 10);
    return [
      date,
      lineTypeLabel(line.type),
      line.description,
      line.debit > 0 ? formatAmount(line.debit) : '',
      line.credit > 0 ? formatAmount(line.credit) : '',
      formatAmount(line.balance),
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  const summaryRow = [
    '',
    '',
    customersT('statement.export.summaryLabel'),
    formatAmount(summary.totalDebit),
    formatAmount(summary.totalCredit),
    formatAmount(summary.balance),
  ]
    .map(escapeCsvCell)
    .join(',');

  const csv = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows, summaryRow].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cari-ekstre-${customerId.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
