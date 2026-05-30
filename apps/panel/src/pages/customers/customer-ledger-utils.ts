export function ledgerBalanceClass(balance: string): string {
  const n = Number(balance);
  if (Number.isNaN(n) || n === 0) {
    return 'text-muted-foreground';
  }
  if (n > 0) {
    return 'text-amber-600 dark:text-amber-400';
  }
  return 'text-emerald-600 dark:text-emerald-400';
}
