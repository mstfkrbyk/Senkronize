import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { EncryptionService } from '../common/encryption/encryption.service';
import { InvoiceService } from '../invoice/invoice.service';
import { PrismaService } from '../prisma/prisma.service';

import { AccountingInvoiceService } from './accounting-invoice.service';

describe('AccountingInvoiceService', () => {
  let service: AccountingInvoiceService;
  let prisma: {
    invoice: {
      aggregate: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let invoiceService: { findOne: jest.Mock };

  beforeEach(async () => {
    prisma = {
      invoice: {
        aggregate: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    invoiceService = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingInvoiceService,
        { provide: PrismaService, useValue: prisma },
        { provide: InvoiceService, useValue: invoiceService },
        { provide: EncryptionService, useValue: {} },
        { provide: AdapterRegistry, useValue: {} },
      ],
    }).compile();

    service = module.get(AccountingInvoiceService);
  });

  it('getVatSummary — org faturalarından ay bazlı KDV toplar', async () => {
    prisma.invoice.aggregate.mockResolvedValue({
      _sum: {
        subtotal: new Prisma.Decimal('1000'),
        taxAmount: new Prisma.Decimal('200'),
        totalAmount: new Prisma.Decimal('1200'),
      },
    });
    prisma.invoice.count.mockResolvedValue(3);

    const result = await service.getVatSummary('org-1', '2026-05');

    expect(result).toEqual({
      month: '2026-05',
      invoiceCount: 3,
      subtotal: '1000',
      taxAmount: '200',
      totalAmount: '1200',
      currency: 'TRY',
    });
    expect(prisma.invoice.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          deletedAt: null,
          status: { not: 'CANCELLED' },
          createdAt: {
            gte: new Date(2026, 4, 1, 0, 0, 0, 0),
            lte: new Date(2026, 4, 31, 23, 59, 59, 999),
          },
        }),
      }),
    );
  });

  it('getRevenueTrend — org faturalarından ay bazlı toplam döner', async () => {
    prisma.invoice.aggregate.mockResolvedValue({
      _sum: { totalAmount: new Prisma.Decimal('4500') },
    });
    prisma.invoice.count.mockResolvedValue(2);

    const result = await service.getRevenueTrend('org-1', 2);

    expect(result.months).toBe(2);
    expect(result.currency).toBe('TRY');
    expect(result.points).toHaveLength(2);
    expect(result.points.every((p) => p.invoiceCount === 2)).toBe(true);
    expect(result.points.every((p) => p.totalAmount === '4500')).toBe(true);
    expect(result.points.every((p) => /^\d{4}-\d{2}$/.test(p.month))).toBe(true);
    expect(prisma.invoice.aggregate).toHaveBeenCalledTimes(2);
    expect(prisma.invoice.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          deletedAt: null,
          status: { not: 'CANCELLED' },
        }),
      }),
    );
  });

  describe('markPaid', () => {
    const baseInvoice = {
      id: 'inv-1',
      organizationId: 'org-1',
      deletedAt: null,
      status: InvoiceStatus.SENT,
      totalAmount: new Prisma.Decimal('1200'),
    };

    it('SENT faturayı PAID yapar ve paidAt / paymentMethod yazar', async () => {
      prisma.invoice.findFirst.mockResolvedValue(baseInvoice);
      prisma.invoice.update.mockResolvedValue({});
      invoiceService.findOne.mockResolvedValue({
        id: 'inv-1',
        status: InvoiceStatus.PAID,
        paidAt: '2026-05-20T10:00:00.000Z',
        paymentMethod: 'BANK_TRANSFER',
      });

      const paidAt = '2026-05-20T10:00:00.000Z';
      const result = await service.markPaid('org-1', 'inv-1', {
        paidAt,
        paymentMethod: 'BANK_TRANSFER',
      });

      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
        where: { id: 'inv-1', organizationId: 'org-1', deletedAt: null },
      });
      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv-1' },
        data: {
          status: InvoiceStatus.PAID,
          paidAt: new Date(paidAt),
          paymentMethod: 'BANK_TRANSFER',
        },
      });
      expect(invoiceService.findOne).toHaveBeenCalledWith('org-1', 'inv-1');
    });

    it('zaten PAID ise ConflictException fırlatır', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        status: InvoiceStatus.PAID,
      });

      await expect(service.markPaid('org-1', 'inv-1', {})).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.invoice.update).not.toHaveBeenCalled();
    });

    it('DRAFT faturada BadRequestException fırlatır', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        ...baseInvoice,
        status: InvoiceStatus.DRAFT,
      });

      await expect(service.markPaid('org-1', 'inv-1', {})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('fatura bulunamazsa NotFoundException fırlatır', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(service.markPaid('org-1', 'missing', {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
