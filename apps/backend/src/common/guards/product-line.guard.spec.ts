import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { OrgProductLine } from '@prisma/client';

import { ProductLineGuard } from './product-line.guard';
import { PrismaService } from '../../prisma/prisma.service';

function mockHttpContext(orgId: string): ExecutionContext {
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => ({ user: { currentOrgId: orgId } }),
    }),
  } as unknown as ExecutionContext;
}

describe('ProductLineGuard', () => {
  let guard: ProductLineGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let prisma: { organization: { findFirst: jest.Mock } };

  beforeEach(async () => {
    reflector = { getAllAndOverride: jest.fn() };
    prisma = { organization: { findFirst: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductLineGuard,
        { provide: Reflector, useValue: reflector },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    guard = module.get(ProductLineGuard);
  });

  it('INTEGRATION hattı yoksa entegrasyon endpointinde 403', async () => {
    reflector.getAllAndOverride.mockReturnValue(OrgProductLine.INTEGRATION);
    prisma.organization.findFirst.mockResolvedValue({
      productLines: [OrgProductLine.ACCOUNTING],
    });

    await expect(guard.canActivate(mockHttpContext('org-1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('ACCOUNTING hattı varsa muhasebe endpointinde geçer', async () => {
    reflector.getAllAndOverride.mockReturnValue(OrgProductLine.ACCOUNTING);
    prisma.organization.findFirst.mockResolvedValue({
      productLines: [OrgProductLine.ACCOUNTING],
    });

    await expect(guard.canActivate(mockHttpContext('org-2'))).resolves.toBe(true);
  });

  it('dekoratör yoksa geçer', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(mockHttpContext('org-3'))).resolves.toBe(true);
    expect(prisma.organization.findFirst).not.toHaveBeenCalled();
  });
});
