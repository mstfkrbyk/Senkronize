import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import { Marketplace } from '@prisma/client';
import type { Queue } from 'bull';
import { validate } from 'class-validator';

import { PrismaService } from '../prisma/prisma.service';
import {
  JOB_DEFAULT_OPTIONS,
  QUEUE_MARKETPLACE_PUSH,
} from '../queue/queue.constants';
import type { MarketplacePushJobData } from '../queue/queue.types';
import { ListingPushService } from '../sync/listing-push.service';
import { WarehouseService } from '../warehouse/warehouse.service';
import { OutboundWebhookService } from '../webhook/outbound-webhook.service';
import { WebhookEvent } from '../webhook/webhook-event.enum';

import { ErpSyncSettingsService } from '../erp/erp-sync-settings.service';
import { CacheService } from '../common/cache/cache.service';
import { StockAdjustDto } from './stock.dto';
import { StockMovementService } from './stock-movement.service';
import { StockService } from './stock.service';

describe('StockService', () => {
  let service: StockService;
  let movementService: StockMovementService;
  let prisma: {
    marketplaceConnection: { findMany: jest.Mock };
    $transaction: jest.Mock;
    stockEntry: { findMany: jest.Mock; count: jest.Mock; findFirst: jest.Mock; update: jest.Mock; create: jest.Mock };
    warehouse: { findFirst: jest.Mock };
    product: { findFirst: jest.Mock };
    stockMovement: { create: jest.Mock };
  };
  let queueAdd: jest.Mock;
  let outboundDispatch: jest.Mock;

  beforeEach(async () => {
    outboundDispatch = jest.fn().mockResolvedValue(undefined);
    queueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
    const marketplacePushQueue = {
      add: queueAdd,
    } as unknown as Queue<MarketplacePushJobData>;
    const listingPushService = {
      enqueueStockPushForBarcode: jest.fn().mockResolvedValue(0),
    };

    prisma = {
      marketplaceConnection: { findMany: jest.fn() },
      $transaction: jest.fn((fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma)),
      stockEntry: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      warehouse: { findFirst: jest.fn().mockResolvedValue({ id: 'wh-1', code: 'MAIN' }) },
      product: { findFirst: jest.fn().mockResolvedValue({ id: 'prod-1' }) },
      stockMovement: { create: jest.fn().mockResolvedValue({ id: 'mov-1' }) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        StockMovementService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: OutboundWebhookService,
          useValue: { dispatch: outboundDispatch },
        },
        {
          provide: getQueueToken(QUEUE_MARKETPLACE_PUSH),
          useValue: marketplacePushQueue,
        },
        {
          provide: ListingPushService,
          useValue: listingPushService,
        },
        {
          provide: WarehouseService,
          useValue: {
            getOrCreateMainWarehouse: jest.fn().mockResolvedValue({ id: 'wh-1' }),
          },
        },
        {
          provide: CacheService,
          useValue: {
            invalidateStockForOrg: jest.fn().mockResolvedValue(undefined),
            readThrough: jest.fn(
              (_k: string, _t: number, fn: () => Promise<unknown>) => fn(),
            ),
          },
        },
        {
          provide: ErpSyncSettingsService,
          useValue: { isErpStockSyncEnabled: jest.fn().mockResolvedValue(false) },
        },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
    movementService = module.get<StockMovementService>(StockMovementService);
  });

  it('stok güncelleme doğru hareket kaydeder', async () => {
    prisma.stockEntry.findFirst.mockResolvedValue({
      id: 'entry-1',
      quantity: 20,
    });
    prisma.stockEntry.update.mockResolvedValue({ id: 'entry-1', quantity: 15 });

    await movementService.adjustStock('org-1', '8690000001', 15, 'test düzeltme');

    expect(prisma.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-1',
          barcode: '8690000001',
          beforeQuantity: 20,
          afterQuantity: 15,
          quantity: -5,
        }),
      }),
    );
  });

  it('negatif stok izin verilmez', async () => {
    const dto = Object.assign(new StockAdjustDto(), {
      barcode: '8690000001',
      newQuantity: -1,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('stok 10 altına düşünce alarm oluşturur', async () => {
    prisma.marketplaceConnection.findMany.mockResolvedValue([
      { platform: Marketplace.TRENDYOL },
    ]);

    await service.bulkUpdate('org-1', {
      updates: [{ barcode: '8690000001', quantity: 5 }],
    });

    expect(outboundDispatch).toHaveBeenCalledWith(
      'org-1',
      WebhookEvent.STOCK_LOW,
      expect.objectContaining({ barcode: '8690000001', quantity: 5 }),
    );
    expect(queueAdd).toHaveBeenCalledWith(
      'push-stock',
      expect.objectContaining({ organizationId: 'org-1' }),
      JOB_DEFAULT_OPTIONS,
    );
  });

  it('çoklu depo stok toplamı doğru hesaplanır', async () => {
    prisma.stockEntry.findMany.mockResolvedValue([
      {
        barcode: 'MULTI1',
        quantity: 7,
        reservedQty: 1,
        platform: null,
        warehouseId: 'wh-1',
        product: { name: 'Ürün', sku: 'SKU' },
        warehouse: { id: 'wh-1', code: 'A', name: 'Depo A' },
      },
      {
        barcode: 'MULTI1',
        quantity: 3,
        reservedQty: 0,
        platform: null,
        warehouseId: 'wh-2',
        product: { name: 'Ürün', sku: 'SKU' },
        warehouse: { id: 'wh-2', code: 'B', name: 'Depo B' },
      },
    ]);

    const { rows } = await service.getManagementOverview('org-1');
    expect(rows).toHaveLength(1);
    expect(rows[0].totalQuantity).toBe(10);
    expect(rows[0].available).toBe(9);
    expect(rows[0].byWarehouse).toHaveLength(2);
  });
});
