import { Injectable, NotFoundException } from '@nestjs/common';
import type { Invoice } from '@prisma/client';

import { InvoiceService } from '../invoice/invoice.service';
import { PrismaService } from '../prisma/prisma.service';

import { AccountingLedgerService } from './accounting-ledger.service';
import type {
  CustomerLedgerSummariesMap,
  CustomerLedgerSummary,
  CustomerStatement,
  CustomersBalanceSummary,
} from './accounting.types';

@Injectable()
export class AccountingCustomerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceService: InvoiceService,
    private readonly ledgerService: AccountingLedgerService,
  ) {}

  async getStatement(organizationId: string, customerId: string): Promise<CustomerStatement> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException('Müşteri bulunamadı');
    }

    const invoices = await this.fetchInvoicesForCustomers(organizationId, [customer], 500);
    const matched = this.ledgerService.filterInvoicesForCustomer(customer, invoices);
    const balance = this.ledgerService.computeBalanceFromInvoices(
      matched,
      matched[0]?.currency ?? 'TRY',
    );
    const entries = this.ledgerService.buildLedgerFromInvoices(matched);
    const serializedInvoices = await Promise.all(
      matched.map((inv) => this.invoiceService.findOne(organizationId, inv.id)),
    );

    return {
      customerId: customer.id,
      customerName: customer.name,
      balance,
      entries,
      invoices: serializedInvoices,
    };
  }

  async getBalanceSummary(organizationId: string): Promise<CustomersBalanceSummary> {
    const summaries = await this.getLedgerSummaries(organizationId);
    const values = Object.values(summaries);
    let debitSum = 0;
    let creditSum = 0;
    for (const summary of values) {
      debitSum += Number(summary.debit);
      creditSum += Number(summary.credit);
    }
    const round2 = (n: number): string => (Math.round(n * 100) / 100).toFixed(2);
    return {
      totalDebit: round2(debitSum),
      totalCredit: round2(creditSum),
      netBalance: round2(debitSum - creditSum),
      customerCount: values.length,
      currency: values[0]?.currency ?? 'TRY',
    };
  }

  async getLedgerSummaries(
    organizationId: string,
    customerIds?: string[],
  ): Promise<CustomerLedgerSummariesMap> {
    const customers = await this.findCustomersForLedger(organizationId, customerIds);
    const invoices = await this.fetchInvoicesForCustomers(organizationId, customers, 2000);

    const summaries: CustomerLedgerSummariesMap = {};
    for (const customer of customers) {
      const matched = this.ledgerService.filterInvoicesForCustomer(customer, invoices);
      const balance = this.ledgerService.computeBalanceFromInvoices(
        matched,
        matched[0]?.currency ?? 'TRY',
      );
      summaries[customer.id] = this.toLedgerSummary(balance);
    }
    return summaries;
  }

  private async findCustomersForLedger(
    organizationId: string,
    customerIds?: string[],
  ): Promise<Array<{ id: string; name: string; email: string | null; phone: string | null }>> {
    const select = {
      id: true,
      name: true,
      email: true,
      phone: true,
    } as const;

    if (customerIds?.length) {
      return this.prisma.customer.findMany({
        where: { organizationId, deletedAt: null, id: { in: customerIds } },
        select,
      });
    }

    return this.prisma.customer.findMany({
      where: { organizationId, deletedAt: null, email: { not: null } },
      select,
    });
  }

  private async fetchInvoicesForCustomers(
    organizationId: string,
    customers: Array<{ name: string; email: string | null; phone: string | null }>,
    take: number,
  ): Promise<Invoice[]> {
    const where = this.ledgerService.buildInvoicesWhereForCustomers(organizationId, customers);
    if (!where) {
      return [];
    }
    return this.prisma.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  private toLedgerSummary(balance: {
    receivable: string;
    collected: string;
    netBalance: string;
    currency: string;
  }): CustomerLedgerSummary {
    return {
      debit: balance.receivable,
      credit: balance.collected,
      balance: balance.netBalance,
      currency: balance.currency,
    };
  }
}
