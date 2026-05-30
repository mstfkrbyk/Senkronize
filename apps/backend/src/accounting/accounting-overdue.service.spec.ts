import { InvoiceStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';

import { AccountingOverdueService } from './accounting-overdue.service';

describe('AccountingOverdueService', () => {
  let service: AccountingOverdueService;
  let prisma: {
    invoice: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      invoice: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingOverdueService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(AccountingOverdueService);
  });

  it('markOverdueSentInvoices — org bazlı SENT → OVERDUE günceller', async () => {
    const now = new Date('2026-05-20T12:00:00.000Z');
    prisma.invoice.findMany.mockResolvedValue([
      { organizationId: 'org-1' },
      { organizationId: 'org-2' },
    ]);
    prisma.invoice.updateMany
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await service.markOverdueSentInvoices(now);

    expect(result).toEqual({
      organizationsProcessed: 2,
      invoicesUpdated: 3,
    });
    expect(prisma.invoice.updateMany).toHaveBeenCalledTimes(2);
    expect(prisma.invoice.updateMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        status: InvoiceStatus.SENT,
        dueDate: { lt: now, not: null },
        deletedAt: null,
      },
      data: { status: InvoiceStatus.OVERDUE },
    });
  });
});
