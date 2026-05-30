import { Test, TestingModule } from '@nestjs/testing';
import { Marketplace, OrderStatus } from '@prisma/client';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { CustomerService } from '../customer/customer.service';
import { EventService } from '../event/event.service';
import { MarketplaceConnectionService } from '../marketplace-connection/marketplace-connection.service';
import { PrismaService } from '../prisma/prisma.service';

import { OrderPullService } from './order-pull.service';
import { OrderService } from './order.service';

describe('OrderPullService', () => {
  let service: OrderPullService;
  let customerService: { upsertFromOrder: jest.Mock };
  let orderService: { upsertFromPlatform: jest.Mock };
  let prisma: { order: { findMany: jest.Mock } };

  const orgId = 'org-1';
  const platform = Marketplace.N11;

  beforeEach(async () => {
    customerService = {
      upsertFromOrder: jest.fn().mockResolvedValue({ id: 'cust-1' }),
    };
    orderService = {
      upsertFromPlatform: jest.fn(),
    };
    prisma = {
      order: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderPullService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: MarketplaceConnectionService,
          useValue: { getDecryptedCredentialsForJob: jest.fn() },
        },
        { provide: OrderService, useValue: orderService },
        { provide: CustomerService, useValue: customerService },
        { provide: EventService, useValue: { emit: jest.fn() } },
        { provide: AdapterRegistry, useValue: { get: jest.fn(), hasEcommerceAdapter: jest.fn() } },
      ],
    }).compile();

    service = module.get(OrderPullService);
  });

  describe('persistOrders', () => {
    it('yalnızca yeni siparişlerde müşteri upsert eder', async () => {
      const existingOrder = {
        id: 'ord-existing',
        organizationId: orgId,
        platform,
        platformOrderId: 'existing-1',
        status: OrderStatus.NEW,
        customerName: 'Eski Müşteri',
        totalAmount: 100,
        currency: 'TRY',
        createdAt: new Date(),
        platformCreatedAt: new Date(),
      };
      const newOrder = {
        ...existingOrder,
        id: 'ord-new',
        platformOrderId: 'new-1',
        customerName: 'Yeni Müşteri',
      };

      prisma.order.findMany.mockResolvedValue([
        { platformOrderId: 'existing-1' },
      ]);
      orderService.upsertFromPlatform.mockResolvedValue({
        createdOrders: [existingOrder, newOrder],
      });

      await service.persistOrders(orgId, platform, [
        {
          platformOrderId: 'existing-1',
          status: 'New',
          customerName: 'Eski Müşteri',
          totalAmount: 100,
          currency: 'TRY',
          createdAt: new Date().toISOString(),
          items: [],
        },
        {
          platformOrderId: 'new-1',
          status: 'New',
          customerName: 'Yeni Müşteri',
          totalAmount: 200,
          currency: 'TRY',
          createdAt: new Date().toISOString(),
          items: [],
        },
      ]);

      expect(customerService.upsertFromOrder).toHaveBeenCalledTimes(1);
      expect(customerService.upsertFromOrder).toHaveBeenCalledWith(newOrder);
    });
  });
});
