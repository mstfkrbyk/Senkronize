import { Injectable, Logger } from '@nestjs/common';
import { InvoiceStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

export type MarkOverdueInvoicesResult = {
  organizationsProcessed: number;
  invoicesUpdated: number;
};

@Injectable()
export class AccountingOverdueService {
  private readonly logger = new Logger(AccountingOverdueService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Vadesi geçmiş SENT faturaları OVERDUE yapar.
   * Her güncelleme organizationId ile kapsamlıdır (kiracı izolasyonu).
   */
  async markOverdueSentInvoices(now: Date = new Date()): Promise<MarkOverdueInvoicesResult> {
    const orgRows = await this.prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.SENT,
        dueDate: { lt: now, not: null },
        deletedAt: null,
      },
      distinct: ['organizationId'],
      select: { organizationId: true },
    });

    let invoicesUpdated = 0;

    for (const { organizationId } of orgRows) {
      const { count } = await this.prisma.invoice.updateMany({
        where: {
          organizationId,
          status: InvoiceStatus.SENT,
          dueDate: { lt: now, not: null },
          deletedAt: null,
        },
        data: { status: InvoiceStatus.OVERDUE },
      });
      invoicesUpdated += count;
    }

    if (invoicesUpdated > 0) {
      this.logger.log(
        `Vadesi geçen faturalar: ${String(orgRows.length)} org, ${String(invoicesUpdated)} fatura`,
      );
    }

    return {
      organizationsProcessed: orgRows.length,
      invoicesUpdated,
    };
  }
}
