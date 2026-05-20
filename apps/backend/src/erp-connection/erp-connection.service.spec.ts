import { Test, TestingModule } from '@nestjs/testing';
import { AccountingMode, ErpType } from '@prisma/client';
import type { DeepMockProxy } from 'jest-mock-extended';
import { mockDeep } from 'jest-mock-extended';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { EncryptionService } from '../common/encryption/encryption.service';
import { ErpSyncSettingsService } from '../erp/erp-sync-settings.service';
import { PrismaService } from '../prisma/prisma.service';

import { ErpConnectionService } from './erp-connection.service';

describe('ErpConnectionService accountingMode', () => {
  let service: ErpConnectionService;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();
    prisma.erpConnection.findFirst.mockResolvedValue(null);
    prisma.erpConnection.create.mockResolvedValue({
      id: 'conn-1',
      organizationId: 'org-1',
      erpType: ErpType.BIZIMHESAP,
      credentialsEnc: 'enc',
      isActive: true,
      lastSyncAt: null,
      syncErrorCount: 0,
      lastErrorAt: null,
      lastErrorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ErpConnectionService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn().mockReturnValue('enc'),
            decrypt: jest.fn(),
          },
        },
        {
          provide: AdapterRegistry,
          useValue: { hasErpAdapter: jest.fn().mockReturnValue(true) },
        },
        {
          provide: ErpSyncSettingsService,
          useValue: {
            createDefaultForConnection: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(ErpConnectionService);
  });

  it('create sonrası organizasyonu EXTERNAL_ERP yapar', async () => {
    await service.create('org-1', {
      erpType: ErpType.BIZIMHESAP,
      credentials: { apiKey: 'k', apiVersion: 'v2' },
    });

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { accountingMode: AccountingMode.EXTERNAL_ERP },
    });
  });

  it('remove sonrası aktif ERP yoksa NATIVE yapar', async () => {
    prisma.erpConnection.findFirst.mockResolvedValue({
      id: 'conn-1',
      organizationId: 'org-1',
      erpType: ErpType.BIZIMHESAP,
      credentialsEnc: 'enc',
      isActive: true,
      lastSyncAt: null,
      syncErrorCount: 0,
      lastErrorAt: null,
      lastErrorMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    prisma.erpConnection.count.mockResolvedValue(0);

    await service.remove('org-1', 'conn-1');

    expect(prisma.erpConnection.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', deletedAt: null, isActive: true },
    });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      data: { accountingMode: AccountingMode.NATIVE },
    });
  });
});
