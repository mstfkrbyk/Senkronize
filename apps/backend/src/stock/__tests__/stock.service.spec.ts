import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import { Marketplace } from '@prisma/client';
import type { Queue } from 'bull';

import { PrismaService } from '../../prisma/prisma.service';
import { JOB_DEFAULT_OPTIONS, QUEUE_MARKETPLACE_PUSH } from '../../queue/queue.constants';
import type { MarketplacePushJobData } from '../../queue/queue.types';
import { OutboundWebhookService } from '../../webhook/outbound-webhook.service';
import { WebhookEvent } from '../../webhook/webhook-event.enum';
import { StockService } from '../stock.service';

describe('StockService', () => {
  let service: StockService;
  let prisma: {
    marketplaceConnection: { findMany: jest.Mock };
    $transaction: jest.Mock;
    stockEntry: { findMany: jest.Mock; count: jest.Mock };
  };
  let queueAdd: jest.Mock;
  let outboundDispatch: jest.Mock;

  beforeEach(async () => {
    outboundDispatch = jest.fn().mockResolvedValue(undefined);
    queueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });
    const marketplacePushQueue = {
      add: queueAdd,
    } as unknown as Queue<MarketplacePushJobData>;

    prisma = {
      marketplaceConnection: { findMany: jest.fn() },
      $transaction: jest.fn(),
      stockEntry: { findMany: jest.fn(), count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StockService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: OutboundWebhookService,
          useValue: { dispatch: outboundDispatch },
        },
        {
          provide: getQueueToken(QUEUE_MARKETPLACE_PUSH),
          useValue: marketplacePushQueue,
        },
      ],
    }).compile();

    service = module.get<StockService>(StockService);
  });

  describe('bulkUpdate (pazaryeri stok senkronu)', () => {
    it('aktif bağlantılar için kuyruğa stok işi eklemeli', async () => {
      prisma.marketplaceConnection.findMany.mockResolvedValue([
        { platform: Marketplace.TRENDYOL },
        { platform: Marketplace.HEPSIBURADA },
      ]);

      const result = await service.bulkUpdate('org-1', {
        updates: [{ barcode: '8690000001', quantity: 12 }],
      });

      expect(result.jobIds).toHaveLength(2);
      expect(outboundDispatch).toHaveBeenCalledWith(
        'org-1',
        WebhookEvent.STOCK_UPDATED,
        expect.objectContaining({ barcode: '8690000001', newQty: 12 }),
      );
      expect(queueAdd).toHaveBeenCalledTimes(2);
      expect(queueAdd).toHaveBeenCalledWith(
        'push-stock',
        expect.objectContaining({
          organizationId: 'org-1',
          type: 'stock',
          payload: { updates: [{ barcode: '8690000001', quantity: 12 }] },
        }),
        JOB_DEFAULT_OPTIONS,
      );
    });

    it('bağlantı yoksa boş job listesi dönmeli', async () => {
      prisma.marketplaceConnection.findMany.mockResolvedValue([]);
      const result = await service.bulkUpdate('org-1', {
        updates: [{ barcode: '8690000001', quantity: 5 }],
      });
      expect(result.jobIds).toEqual([]);
      expect(queueAdd).not.toHaveBeenCalled();
    });
  });

  describe('getManagementOverview (stok özeti)', () => {
    it('düşük toplam stokta lowStock bayrağı set etmeli', async () => {
      prisma.stockEntry.findMany.mockResolvedValue([
        {
          barcode: 'LOW1',
          quantity: 3,
          reservedQty: 0,
          platform: null,
          warehouseId: 'wh-1',
          product: { name: 'Ürün', sku: 'SKU' },
          warehouse: { id: 'wh-1', code: 'M', name: 'Merkez' },
        },
      ]);

      const { rows } = await service.getManagementOverview('org-1');
      expect(rows).toHaveLength(1);
      expect(rows[0].lowStock).toBe(true);
      expect(rows[0].totalQuantity).toBe(3);
    });

    it('yeterli stokta lowStock false olmalı', async () => {
      prisma.stockEntry.findMany.mockResolvedValue([
        {
          barcode: 'OK1',
          quantity: 50,
          reservedQty: 5,
          platform: Marketplace.TRENDYOL,
          warehouseId: 'wh-1',
          product: { name: 'Ürün', sku: 'SKU' },
          warehouse: { id: 'wh-1', code: 'M', name: 'Merkez' },
        },
      ]);
      const { rows } = await service.getManagementOverview('org-1');
      expect(rows[0].lowStock).toBe(false);
      expect(rows[0].available).toBe(45);
    });
  });
});
