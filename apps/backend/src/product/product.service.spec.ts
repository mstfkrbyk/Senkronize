import { getQueueToken } from '@nestjs/bull';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import type { Queue } from 'bull';

import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_MARKETPLACE_PUSH } from '../queue/queue.constants';
import type { MarketplacePushJobData } from '../queue/queue.types';
import { ListingSyncService } from '../sync/listing-sync.service';
import { OutboundWebhookService } from '../webhook/outbound-webhook.service';

import { ProductImportService } from './product-import.service';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let service: ProductService;
  let prisma: {
    product: {
      findFirst: jest.Mock;
      updateMany: jest.Mock;
      findMany: jest.Mock;
    };
    productCategory: { findFirst: jest.Mock };
  };

  const orgId = 'org-aaaaaaaa';
  const otherOrgId = 'org-bbbbbbbb';
  const productId = 'prod-aaaaaaaa';

  const productRow = {
    id: productId,
    organizationId: orgId,
    barcode: '8680001122334',
    sku: null,
    name: 'Test Ürün',
    description: null,
    brand: null,
    category: null,
    categoryId: null,
    costPrice: new Prisma.Decimal('10'),
    reorderPoint: null,
    reorderQty: null,
    leadTimeDays: null,
    tags: [],
    imageUrls: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findFirst: jest.fn().mockResolvedValue(productRow),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      productCategory: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: CacheService,
          useValue: {
            invalidateProductsForOrg: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: OutboundWebhookService,
          useValue: { dispatch: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ProductImportService,
          useValue: {},
        },
        {
          provide: getQueueToken(QUEUE_MARKETPLACE_PUSH),
          useValue: { add: jest.fn() } as unknown as Queue<MarketplacePushJobData>,
        },
        {
          provide: ListingSyncService,
          useValue: { afterProductUpdate: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(ProductService);
  });

  describe('update', () => {
    it('PATCH costPrice: updateMany organizationId ve Decimal uygular', async () => {
      const updatedRow = {
        ...productRow,
        costPrice: new Prisma.Decimal('99.5'),
      };
      prisma.product.findFirst
        .mockResolvedValueOnce(productRow)
        .mockResolvedValueOnce(updatedRow);

      const result = await service.update(orgId, productId, { costPrice: 99.5 });

      expect(prisma.product.updateMany).toHaveBeenCalledWith({
        where: { id: productId, organizationId: orgId, deletedAt: null },
        data: { costPrice: new Prisma.Decimal(99.5) },
      });
      expect(result.costPrice).toBe('99.5');
    });
  });

  describe('findOne', () => {
    it('costPrice yanıtta string döner', async () => {
      const result = await service.findOne(orgId, productId);

      expect(result.costPrice).toBe('10');
      expect(typeof result.costPrice).toBe('string');
    });

    it('maliyet null ise costPrice null döner', async () => {
      prisma.product.findFirst.mockResolvedValue({
        ...productRow,
        costPrice: null,
      });

      const result = await service.findOne(orgId, productId);

      expect(result.costPrice).toBeNull();
    });

    it('başka organizasyonun ürününe erişemez (findOne organizationId filtresi)', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.update(otherOrgId, productId, { costPrice: 50 }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.product.updateMany).not.toHaveBeenCalled();
    });
  });
});
