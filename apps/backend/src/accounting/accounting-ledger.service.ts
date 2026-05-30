import { Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma, type Invoice } from '@prisma/client';

import { accountingPaymentMethodLabel } from './accounting-payment-labels';
import {
  type LedgerEntry,
  type LedgerEntryType,
  toAccountingStatus,
} from './accounting.types';

const OPEN_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.DRAFT,
  InvoiceStatus.SENT,
  InvoiceStatus.OVERDUE,
];

@Injectable()
export class AccountingLedgerService {
  invoiceToLedgerEntries(invoice: Invoice): LedgerEntry[] {
    const total = invoice.totalAmount.toString();
    const status = toAccountingStatus(invoice.status);
    const invoiceDescription = `${invoice.invoiceNumber} — ${invoice.customerName}`;

    if (invoice.status === InvoiceStatus.PAID) {
      const methodLabel = accountingPaymentMethodLabel(invoice.paymentMethod);
      const paymentDescription = methodLabel
        ? `${invoice.invoiceNumber} — Tahsilat (${methodLabel})`
        : `${invoice.invoiceNumber} — Tahsilat`;

      return [
        {
          id: `ledger-invoice-${invoice.id}`,
          date: invoice.createdAt.toISOString(),
          type: 'INVOICE',
          description: invoiceDescription,
          debit: total,
          credit: '0',
          referenceId: invoice.id,
          referenceType: 'invoice',
          status,
        },
        {
          id: `ledger-payment-${invoice.id}`,
          date: (invoice.paidAt ?? invoice.createdAt).toISOString(),
          type: 'PAYMENT',
          description: paymentDescription,
          debit: '0',
          credit: total,
          referenceId: invoice.id,
          referenceType: 'invoice',
          status,
        },
      ];
    }

    const type: LedgerEntryType = 'INVOICE';
    return [
      {
        id: `ledger-invoice-${invoice.id}`,
        date: invoice.createdAt.toISOString(),
        type,
        description: invoiceDescription,
        debit: total,
        credit: '0',
        referenceId: invoice.id,
        referenceType: 'invoice',
        status,
      },
    ];
  }

  buildLedgerFromInvoices(invoices: Invoice[]): LedgerEntry[] {
    return invoices
      .filter((inv) => inv.status !== InvoiceStatus.CANCELLED)
      .flatMap((inv) => this.invoiceToLedgerEntries(inv))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  computeBalanceFromInvoices(invoices: Invoice[], currency = 'TRY'): {
    receivable: string;
    collected: string;
    netBalance: string;
    currency: string;
  } {
    let receivable = 0;
    let collected = 0;
    for (const inv of invoices) {
      if (inv.status === InvoiceStatus.CANCELLED) {
        continue;
      }
      const amount = Number(inv.totalAmount);
      if (inv.status === InvoiceStatus.PAID) {
        collected += amount;
      } else if (OPEN_STATUSES.includes(inv.status)) {
        receivable += amount;
      }
    }
    const recv = (Math.round(receivable * 100) / 100).toFixed(2);
    const coll = (Math.round(collected * 100) / 100).toFixed(2);
    const net = (Math.round((receivable - collected) * 100) / 100).toFixed(2);
    return { receivable: recv, collected: coll, netBalance: net, currency };
  }

  buildInvoiceMatchOrClauses(
    customer: { name: string; email: string | null; phone: string | null },
  ): Prisma.InvoiceWhereInput[] {
    const clauses: Prisma.InvoiceWhereInput[] = [];
    const trimmedName = customer.name.trim();
    if (trimmedName.length > 0) {
      clauses.push({
        customerName: { equals: trimmedName, mode: 'insensitive' },
      });
    }
    const trimmedEmail = customer.email?.trim();
    if (trimmedEmail) {
      clauses.push({
        customerEmail: { equals: trimmedEmail, mode: 'insensitive' },
      });
    }
    const trimmedPhone = customer.phone?.trim();
    if (trimmedPhone) {
      clauses.push({ customerPhone: trimmedPhone });
    }
    return clauses;
  }

  buildInvoicesWhereForCustomers(
    organizationId: string,
    customers: Array<{ name: string; email: string | null; phone: string | null }>,
  ): Prisma.InvoiceWhereInput | null {
    const orClauses = customers.flatMap((c) => this.buildInvoiceMatchOrClauses(c));
    if (orClauses.length === 0) {
      return null;
    }
    return {
      organizationId,
      deletedAt: null,
      OR: orClauses,
    };
  }

  filterInvoicesForCustomer(
    customer: { name: string; email: string | null; phone: string | null },
    invoices: Invoice[],
  ): Invoice[] {
    const nameNorm = customer.name.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (inv.customerName.trim().toLowerCase() === nameNorm) {
        return true;
      }
      if (
        customer.email &&
        inv.customerEmail &&
        inv.customerEmail.toLowerCase() === customer.email.toLowerCase()
      ) {
        return true;
      }
      if (
        customer.phone &&
        inv.customerPhone &&
        inv.customerPhone === customer.phone
      ) {
        return true;
      }
      return false;
    });
  }
}
