import { AccountingMode } from '@prisma/client';
import type { DeepMockProxy } from 'jest-mock-extended';
import { mockDeep } from 'jest-mock-extended';

import { ACCOUNTING_MODE_NATIVE_BLOCKED_MESSAGE } from '../common/accounting-mode';
import { PrismaService } from '../prisma/prisma.service';

import { OrganizationService } from './organization.service';

describe('OrganizationService.update accountingMode', () => {
  let service: OrganizationService;
  let prisma: DeepMockProxy<PrismaService>;

  const orgId = 'org-1';
  const orgRow = {
    id: orgId,
    slug: 'test',
    name: 'Test',
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = mockDeep<PrismaService>();
    prisma.organization.findFirst.mockResolvedValue(orgRow as never);
    prisma.organization.update.mockResolvedValue({
      ...orgRow,
      accountingMode: AccountingMode.NATIVE,
    } as never);
    service = new OrganizationService(prisma);
  });

  it('aktif ERP yokken NATIVE modunu kaydeder', async () => {
    prisma.erpConnection.count.mockResolvedValue(0);

    await service.update(orgId, { accountingMode: AccountingMode.NATIVE });

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: orgId },
      data: expect.objectContaining({ accountingMode: AccountingMode.NATIVE }),
    });
  });

  it('aktif ERP varken NATIVE için ConflictException fırlatır', async () => {
    prisma.erpConnection.count.mockResolvedValue(2);

    await expect(
      service.update(orgId, { accountingMode: AccountingMode.NATIVE }),
    ).rejects.toThrow(ACCOUNTING_MODE_NATIVE_BLOCKED_MESSAGE);

    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('aktif ERP varken EXTERNAL_ERP kaydına izin verir', async () => {
    prisma.erpConnection.count.mockResolvedValue(1);

    await service.update(orgId, { accountingMode: AccountingMode.EXTERNAL_ERP });

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: orgId },
      data: expect.objectContaining({
        accountingMode: AccountingMode.EXTERNAL_ERP,
      }),
    });
  });
});
