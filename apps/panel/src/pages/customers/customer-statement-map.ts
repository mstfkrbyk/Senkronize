import type {
  CustomerStatementApi,
  CustomerStatementDto,
  CustomerStatementLine,
} from './customer-statement.types';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function mapCustomerStatementApi(api: CustomerStatementApi): CustomerStatementDto {
  const invoicePaidAt = new Map(
    api.invoices.map((inv) => [inv.id, inv.paidAt] as const),
  );

  const sortedEntries = [...api.entries].sort((a, b) => a.date.localeCompare(b.date));

  let running = 0;
  const linesAsc: CustomerStatementLine[] = sortedEntries.map((entry) => {
    const debit = Number(entry.debit);
    const credit = Number(entry.credit);
    running = roundMoney(running + debit - credit);

    const paidAt =
      entry.type === 'PAYMENT'
        ? (invoicePaidAt.get(entry.referenceId) ?? entry.date)
        : null;

    return {
      id: entry.id,
      type: entry.type,
      date: entry.date,
      paidAt,
      description: entry.description,
      debit,
      credit,
      balance: running,
    };
  });

  return {
    totalDebit: Number(api.balance.receivable),
    totalCredit: Number(api.balance.collected),
    balance: Number(api.balance.netBalance),
    lines: [...linesAsc].reverse(),
  };
}
