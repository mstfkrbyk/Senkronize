/** `GET /accounting/customers/balance-summary` */
export interface CustomersBalanceSummary {
  totalDebit: string;
  totalCredit: string;
  netBalance: string;
  customerCount: number;
  currency: string;
}
