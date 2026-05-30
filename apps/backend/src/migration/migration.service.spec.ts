import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_DATA_IMPORT } from '../queue/queue.constants';

import { MigrationImportExecutor } from './migration-import.executor';
import { MigrationSessionStore } from './migration-session.store';
import { MigrationService } from './migration.service';

describe('MigrationService', () => {
  let service: MigrationService;

  const orgId = 'org-aaaaaaaa';

  const prisma = {
    organization: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.organization.findFirst.mockResolvedValue({
      metadata: {
        migrationImportHistory: [
          {
            id: 'hist-1',
            createdAt: '2026-05-20T12:00:00.000Z',
            sourceFormat: 'ticimax_csv',
            dataType: 'products',
            fileName: 'urun.csv',
            total: 10,
            success: 9,
            failed: 1,
            status: 'completed',
          },
        ],
      },
    });
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MigrationService,
        { provide: MigrationSessionStore, useValue: {} },
        { provide: MigrationImportExecutor, useValue: {} },
        { provide: PrismaService, useValue: prisma },
        {
          provide: getQueueToken(QUEUE_DATA_IMPORT),
          useValue: { add: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(MigrationService);
  });

  describe('getImportHistory', () => {
    it('organization metadata içindeki kayıtları listeler', async () => {
      const result = await service.getImportHistory(orgId);

      expect(prisma.organization.findFirst).toHaveBeenCalledWith({
        where: { id: orgId, deletedAt: null },
        select: { metadata: true },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'hist-1',
        sourceLabel: 'Ticimax',
        fileName: 'urun.csv',
        total: 10,
        success: 9,
        failed: 1,
        status: 'completed',
      });
    });

    it('organizasyon yoksa boş liste döner', async () => {
      prisma.organization.findFirst.mockResolvedValue(null);

      const result = await service.getImportHistory(orgId);

      expect(result).toEqual([]);
    });
  });
});
