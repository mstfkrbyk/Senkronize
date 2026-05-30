import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import { Marketplace } from '@prisma/client';

import { ListingService } from '../listing/listing.service';
import { OrderService } from '../order/order.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_MARKETPLACE_PULL } from '../queue/queue.constants';

import { WebhookProcessorService } from './webhook-processor.service';

describe('WebhookProcessorService', () => {
  let service: WebhookProcessorService;
  let orderService: { updateStatusFromPlatform: jest.Mock };
  let marketplacePullQueue: { add: jest.Mock };

  const orgId = 'org-n11';

  beforeEach(async () => {
    orderService = {
      updateStatusFromPlatform: jest.fn().mockResolvedValue(undefined),
    };
    marketplacePullQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookProcessorService,
        {
          provide: PrismaService,
          useValue: {
            webhookLog: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        { provide: OrderService, useValue: orderService },
        { provide: ListingService, useValue: {} },
        {
          provide: getQueueToken(QUEUE_MARKETPLACE_PULL),
          useValue: marketplacePullQueue,
        },
      ],
    }).compile();

    service = module.get(WebhookProcessorService);
  });

  describe('processN11', () => {
    it('yeni siparişte pull-orders kuyruğuna ekler', async () => {
      await service.processN11({ eventType: 'ORDER_CREATED' }, orgId);

      expect(marketplacePullQueue.add).toHaveBeenCalledWith(
        'pull-orders',
        {
          organizationId: orgId,
          platform: Marketplace.N11,
          type: 'orders',
        },
        expect.any(Object),
      );
      expect(orderService.updateStatusFromPlatform).not.toHaveBeenCalled();
    });

    it('durum güncellemesinde fromPlatformWebhook ile günceller', async () => {
      await service.processN11(
        {
          eventType: 'ORDER_STATUS_UPDATE',
          orderId: '12345',
          status: 'Shipped',
        },
        orgId,
      );

      expect(orderService.updateStatusFromPlatform).toHaveBeenCalledWith(
        orgId,
        Marketplace.N11,
        '12345',
        'Shipped',
        { fromPlatformWebhook: true },
      );
      expect(marketplacePullQueue.add).not.toHaveBeenCalled();
    });

    it('iptal olayında fromPlatformWebhook ile günceller', async () => {
      await service.processN11(
        {
          eventType: 'ORDER_CANCELLED',
          orderNumber: 'N11-99',
          status: 'Cancelled',
        },
        orgId,
      );

      expect(orderService.updateStatusFromPlatform).toHaveBeenCalledWith(
        orgId,
        Marketplace.N11,
        'N11-99',
        'Cancelled',
        { fromPlatformWebhook: true },
      );
    });
  });
});
