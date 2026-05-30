import { NotificationType } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationEmitService } from './notification-emit.service';
import { InAppService } from './in-app.service';

describe('InAppService.getPaginatedForOrg', () => {
  let service: InAppService;

  const orgId = 'org-1';
  const userId = 'user-1';

  const prisma = {
    inAppNotification: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.inAppNotification.findMany.mockResolvedValue([]);
    prisma.inAppNotification.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(async (ops: Promise<unknown>[]) =>
      Promise.all(ops),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InAppService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationEmitService, useValue: {} },
      ],
    }).compile();

    service = module.get(InAppService);
  });

  function lastFindManyWhere(): Record<string, unknown> {
    const call = prisma.inAppNotification.findMany.mock.calls.at(-1)?.[0] as
      | { where?: Record<string, unknown> }
      | undefined;
    return call?.where ?? {};
  }

  it('scope integration pazaryeri tipleriyle filtreler', async () => {
    await service.getPaginatedForOrg(orgId, userId, {
      page: 1,
      limit: 20,
      scope: 'integration',
    });

    const where = lastFindManyWhere();
    expect(where.organizationId).toBe(orgId);
    expect(where.OR).toEqual([{ userId: null }, { userId }]);
    expect(where.type).toEqual({
      in: expect.arrayContaining([
        NotificationType.ORDER_NEW,
        NotificationType.SYNC_ERROR,
      ]),
    });
    expect(where.type).toEqual({
      in: expect.not.arrayContaining([NotificationType.SYSTEM]),
    });
  });

  it('scope accounting muhasebe tipleriyle filtreler', async () => {
    await service.getPaginatedForOrg(orgId, userId, {
      page: 1,
      limit: 20,
      scope: 'accounting',
    });

    const where = lastFindManyWhere();
    expect(where.type).toEqual({
      in: expect.arrayContaining([
        NotificationType.SYSTEM,
        NotificationType.PAYMENT_FAILED,
      ]),
    });
    expect(where.type).toEqual({
      in: expect.not.arrayContaining([NotificationType.ORDER_NEW]),
    });
  });

  it('filter order ve scope accounting kesişimi boş tip listesi kullanır', async () => {
    await service.getPaginatedForOrg(orgId, userId, {
      page: 1,
      limit: 20,
      filter: 'order',
      scope: 'accounting',
    });

    expect(lastFindManyWhere().type).toEqual({ in: [] });
  });

  it('filter stock ve scope integration stok tiplerinin kesişimini kullanır', async () => {
    await service.getPaginatedForOrg(orgId, userId, {
      page: 1,
      limit: 20,
      filter: 'stock',
      scope: 'integration',
    });

    expect(lastFindManyWhere().type).toEqual({
      in: [NotificationType.STOCK_LOW, NotificationType.STOCK_OUT],
    });
  });

  it('filter unread okunmamış kayıtları ve tip filtresi uygulamaz', async () => {
    await service.getPaginatedForOrg(orgId, userId, {
      page: 1,
      limit: 20,
      filter: 'unread',
    });

    const where = lastFindManyWhere();
    expect(where.isRead).toBe(false);
    expect(where.type).toBeUndefined();
  });

  it('unreadOnly true iken isRead false uygular', async () => {
    await service.getPaginatedForOrg(orgId, userId, {
      page: 1,
      limit: 20,
      unreadOnly: true,
    });

    expect(lastFindManyWhere().isRead).toBe(false);
  });
});
