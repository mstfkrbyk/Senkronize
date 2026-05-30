import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceStatus, Prisma } from '@prisma/client';

import { OrganizationService } from '../organization/organization.service';
import { PrismaService } from '../prisma/prisma.service';

import { InvoiceService } from './invoice.service';

describe('InvoiceService', () => {
  let service: InvoiceService;
  let prisma: {
    $transaction: jest.Mock;
    invoice: {
      findMany: jest.Mock;
      count: jest.Mock;
    };
  };

  const orgId = 'org-aaaaaaaa';

  const metaCountByStatus: Record<InvoiceStatus, number> = {
    [InvoiceStatus.DRAFT]: 2,
    [InvoiceStatus.SENT]: 3,
    [InvoiceStatus.PAID]: 1,
    [InvoiceStatus.OVERDUE]: 4,
    [InvoiceStatus.CANCELLED]: 0,
  };
  const orderId1 = 'orderid1aaaaaaaaaaaa';
  const orderId2 = 'orderid2aaaaaaaaaaaa';

  const invoiceRow = {
    id: 'inv-1',
    organizationId: orgId,
    orderId: orderId1,
    invoiceNumber: 'FTR-2026-0001',
    invoiceYear: 2026,
    customerName: 'Müşteri',
    customerEmail: null,
    customerPhone: null,
    customerAddress: null,
    customerTaxId: null,
    items: [],
    subtotal: new Prisma.Decimal('100'),
    taxAmount: new Prisma.Decimal('20'),
    taxRate: 20,
    totalAmount: new Prisma.Decimal('120'),
    currency: 'TRY',
    status: InvoiceStatus.DRAFT,
    paidAt: null,
    paymentMethod: null,
    isEArchive: false,
    pdfUrl: null,
    notes: null,
    dueDate: null,
    createdAt: new Date('2026-05-01T10:00:00.000Z'),
    updatedAt: new Date('2026-05-01T10:00:00.000Z'),
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([invoiceRow]),
        count: jest.fn(({ where }: { where?: { status?: InvoiceStatus } }) => {
          if (where?.status) {
            return Promise.resolve(metaCountByStatus[where.status] ?? 0);
          }
          return Promise.resolve(1);
        }),
      },
      $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: prisma },
        { provide: OrganizationService, useValue: {} },
      ],
    }).compile();

    service = module.get(InvoiceService);
  });

  describe('findAll', () => {
    it('orderIds ile orderId IN filtresi ve organizationId uygular', async () => {
      await service.findAll(orgId, {
        orderIds: [orderId1, orderId2],
        page: 1,
        limit: 100,
      });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: orgId,
            deletedAt: null,
            orderId: { in: [orderId1, orderId2] },
          },
        }),
      );
      expect(prisma.invoice.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            orderId: { in: [orderId1, orderId2] },
          }),
        }),
      );
    });

    it('orderIds varken tekil orderId filtresini yok sayar', async () => {
      await service.findAll(orgId, {
        orderIds: [orderId1],
        orderId: orderId2,
      });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            orderId: { in: [orderId1] },
          }),
        }),
      );
    });

    it('meta — organizationId ile DRAFT SENT PAID OVERDUE sayılarını döner', async () => {
      const result = await service.findAll(orgId, { page: 1, limit: 20 });

      expect(result.meta).toEqual({
        DRAFT: 2,
        SENT: 3,
        PAID: 1,
        OVERDUE: 4,
      });
      for (const status of [
        InvoiceStatus.DRAFT,
        InvoiceStatus.SENT,
        InvoiceStatus.PAID,
        InvoiceStatus.OVERDUE,
      ]) {
        expect(prisma.invoice.count).toHaveBeenCalledWith({
          where: { organizationId: orgId, deletedAt: null, status },
        });
      }
    });

    it('meta — liste status filtresinden etkilenmez', async () => {
      await service.findAll(orgId, {
        status: InvoiceStatus.SENT,
        search: 'Acme',
      });

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            status: InvoiceStatus.SENT,
          }),
        }),
      );
      expect(prisma.invoice.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          organizationId: orgId,
          deletedAt: null,
          OR: expect.any(Array),
          status: InvoiceStatus.DRAFT,
        }),
      });
    });

    it('meta — kayıt yoksa tüm durumlar 0', async () => {
      prisma.invoice.count.mockResolvedValue(0);

      const result = await service.findAll(orgId, {});

      expect(result.meta).toEqual({
        DRAFT: 0,
        SENT: 0,
        PAID: 0,
        OVERDUE: 0,
      });
    });
  });
});
