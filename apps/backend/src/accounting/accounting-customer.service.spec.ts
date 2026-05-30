import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceStatus, Prisma } from '@prisma/client';

import { InvoiceService } from '../invoice/invoice.service';
import { PrismaService } from '../prisma/prisma.service';

import { AccountingCustomerService } from './accounting-customer.service';
import { AccountingLedgerService } from './accounting-ledger.service';

describe('AccountingCustomerService', () => {
  let service: AccountingCustomerService;
  let prisma: {
    customer: { findMany: jest.Mock };
    invoice: { findMany: jest.Mock };
  };

  const orgId = 'org-aaaaaaaa';

  beforeEach(async () => {
    prisma = {
      customer: { findMany: jest.fn() },
      invoice: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingCustomerService,
        AccountingLedgerService,
        { provide: PrismaService, useValue: prisma },
        { provide: InvoiceService, useValue: {} },
      ],
    }).compile();

    service = module.get(AccountingCustomerService);
  });

  describe('getBalanceSummary', () => {
    it('organizationId ile müşteri ve faturaları çekip toplam borç/alacak ve sayı döner', async () => {
      prisma.customer.findMany.mockResolvedValue([
        { id: 'cust-1', name: 'Acme', email: 'a@acme.com', phone: null },
        { id: 'cust-2', name: 'Beta', email: 'b@beta.com', phone: null },
      ]);
      prisma.invoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          organizationId: orgId,
          customerName: 'Acme',
          customerEmail: 'a@acme.com',
          customerPhone: null,
          totalAmount: new Prisma.Decimal('1000'),
          status: InvoiceStatus.SENT,
          currency: 'TRY',
          deletedAt: null,
        },
        {
          id: 'inv-2',
          organizationId: orgId,
          customerName: 'Beta',
          customerEmail: 'b@beta.com',
          customerPhone: null,
          totalAmount: new Prisma.Decimal('500'),
          status: InvoiceStatus.PAID,
          currency: 'TRY',
          deletedAt: null,
        },
      ]);

      const result = await service.getBalanceSummary(orgId);

      expect(prisma.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: orgId, deletedAt: null, email: { not: null } },
        }),
      );
      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organizationId: orgId, deletedAt: null }),
        }),
      );
      expect(result).toEqual({
        totalDebit: '1000.00',
        totalCredit: '500.00',
        netBalance: '500.00',
        customerCount: 2,
        currency: 'TRY',
      });
    });

    it('müşteri yoksa sıfır toplamlar ve customerCount 0 döner', async () => {
      prisma.customer.findMany.mockResolvedValue([]);
      prisma.invoice.findMany.mockResolvedValue([]);

      const result = await service.getBalanceSummary(orgId);

      expect(result).toEqual({
        totalDebit: '0.00',
        totalCredit: '0.00',
        netBalance: '0.00',
        customerCount: 0,
        currency: 'TRY',
      });
    });
  });
});
