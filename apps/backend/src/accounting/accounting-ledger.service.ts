import { Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma, type Invoice } from '@prisma/client';

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
  invoiceToLedgerEntry(invoice: Invoice): LedgerEntry {
    const total = invoice.totalAmount.toString();
    const isPayment = invoice.status === InvoiceStatus.PAID;
    const type: LedgerEntryType = isPayment ? 'PAYMENT' : 'INVOICE';
    return {
      id: `ledger-${invoice.id}`,
      date: (isPayment && invoice.paidAt ? invoice.paidAt : invoice.createdAt).toISOString(),
      type,
      description: `${invoice.invoiceNumber} — ${invoice.customerName}`,
      debit: isPayment ? '0' : total,
      credit: isPayment ? total : '0',
      referenceId: invoice.id,
      referenceType: 'invoice',
      status: toAccountingStatus(invoice.status),
    };
  }

  buildLedgerFromInvoices(invoices: Invoice[]): LedgerEntry[] {
    return invoices
      .filter((inv) => inv.status !== InvoiceStatus.CANCELLED)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((inv) => this.invoiceToLedgerEntry(inv));
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
