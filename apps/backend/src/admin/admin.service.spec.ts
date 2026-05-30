import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AccountingMode,
  OrgType,
  PartnerStatus,
  SubStatus,
  UserRole,
} from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import type { AuthenticatedUser } from '../auth/auth.types';
import { SessionService } from '../auth/session.service';
import { EmailService } from '../notifications/email/email.service';
import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { CUSTOMER_ORG_WHERE } from './admin-customer-org';
import { AdminService } from './admin.service';

const cacheServiceMock = {
  readThrough: async <T>(
    _key: string,
    _ttl: number,
    fetcher: () => Promise<T>,
  ): Promise<T> => fetcher(),
};

describe('AdminService.deleteOrganization', () => {
  let service: AdminService;

  const sessionService = {
    revokeAllUserSessions: jest.fn().mockResolvedValue(undefined),
  };

  const prisma = {
    organization: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const platformOrgId = 'platform-org';
  const clientOrgId = 'client-org';

  const actor = {
    id: 'admin-user',
    organizationId: platformOrgId,
    role: UserRole.SUPER_ADMIN,
    email: 'admin@senkronize.com',
    name: 'Super Admin',
    currentOrgId: platformOrgId,
    isImpersonating: false,
  } as AuthenticatedUser;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    prisma.user.findMany.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]);
    prisma.organization.update.mockResolvedValue({});
    prisma.user.updateMany.mockResolvedValue({ count: 2 });
    prisma.auditLog.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(), getOrThrow: jest.fn() },
        },
        { provide: EmailService, useValue: {} },
        { provide: SessionService, useValue: sessionService },
        { provide: CacheService, useValue: cacheServiceMock },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  it('throws NotFound when organization is missing', async () => {
    prisma.organization.findFirst.mockResolvedValue(null);

    await expect(
      service.deleteOrganization(clientOrgId, actor),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects platform organization', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: platformOrgId,
      slug: 'senkronize-platform',
      type: OrgType.DIRECT,
    });

    await expect(
      service.deleteOrganization(platformOrgId, actor),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects actor own organization', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: platformOrgId,
      slug: 'my-company',
      type: OrgType.DIRECT,
    });

    await expect(
      service.deleteOrganization(platformOrgId, actor),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects partner organizations', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: 'partner-org',
      slug: 'acme-partner',
      type: OrgType.PARTNER,
    });

    await expect(
      service.deleteOrganization('partner-org', actor),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('soft-deletes org and users, writes audit log, revokes sessions', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: clientOrgId,
      slug: 'demo-musteri',
      type: OrgType.DIRECT,
    });

    await service.deleteOrganization(clientOrgId, actor);

    expect(prisma.organization.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: clientOrgId },
        data: expect.objectContaining({
          suspended: true,
          deletedAt: expect.any(Date),
        }),
      }),
    );
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: clientOrgId, deletedAt: null },
        data: { deletedAt: expect.any(Date) },
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin.organization_deleted',
          resourceId: clientOrgId,
          metadata: { userCount: 2 },
        }),
      }),
    );
    expect(sessionService.revokeAllUserSessions).toHaveBeenCalledTimes(2);
    expect(sessionService.revokeAllUserSessions).toHaveBeenCalledWith('user-1');
    expect(sessionService.revokeAllUserSessions).toHaveBeenCalledWith('user-2');
  });
});

describe('AdminService.getActiveOrganizations', () => {
  let service: AdminService;

  const prisma = {
    organization: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.organization.findMany.mockResolvedValue([]);
    prisma.organization.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(), getOrThrow: jest.fn() },
        },
        { provide: EmailService, useValue: {} },
        { provide: SessionService, useValue: {} },
        { provide: CacheService, useValue: cacheServiceMock },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  it('filters customer orgs by active partner relationship', async () => {
    await service.getActiveOrganizations(
      1,
      20,
      undefined,
      undefined,
      undefined,
      undefined,
      'partner-org-1',
    );

    expect(prisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            CUSTOMER_ORG_WHERE,
            {
              clientRelationships: {
                some: {
                  partnerOrgId: 'partner-org-1',
                  status: PartnerStatus.ACTIVE,
                },
              },
            },
          ],
        },
      }),
    );
    expect(prisma.organization.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.any(Array),
        }),
      }),
    );
  });

  it('omits partner filter when partner id is blank', async () => {
    await service.getActiveOrganizations(1, 20, undefined, undefined, undefined, undefined, '   ');

    const where = prisma.organization.findMany.mock.calls[0]?.[0]?.where;
    expect(where).not.toMatchObject({
      clientRelationships: expect.anything(),
    });
  });

  it('filters by resolved NATIVE accounting mode', async () => {
    await service.getActiveOrganizations(
      1,
      20,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      AccountingMode.NATIVE,
    );

    expect(prisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            CUSTOMER_ORG_WHERE,
            {
              OR: [
                { accountingMode: AccountingMode.NATIVE },
                {
                  accountingMode: null,
                  erpConnections: { none: { deletedAt: null, isActive: true } },
                },
              ],
            },
          ],
        },
      }),
    );
  });

  it('filters by resolved EXTERNAL_ERP accounting mode', async () => {
    await service.getActiveOrganizations(
      1,
      20,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      AccountingMode.EXTERNAL_ERP,
    );

    expect(prisma.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            CUSTOMER_ORG_WHERE,
            {
              OR: [
                { accountingMode: AccountingMode.EXTERNAL_ERP },
                {
                  accountingMode: null,
                  erpConnections: { some: { deletedAt: null, isActive: true } },
                },
              ],
            },
          ],
        },
      }),
    );
  });

  it('returns resolved accountingMode from stored value or active ERP count', async () => {
    const createdAt = new Date('2026-01-15T10:00:00.000Z');
    prisma.organization.findMany.mockResolvedValue([
      {
        id: 'org-native',
        name: 'Native Co',
        slug: 'native-co',
        taxNumber: null,
        suspended: false,
        createdAt,
        productLines: ['ACCOUNTING'],
        accountingMode: AccountingMode.NATIVE,
        subscription: null,
        users: [],
        orders: [],
        clientRelationships: [],
        _count: {
          users: 1,
          marketplaceConnections: 0,
          orders: 0,
          erpConnections: 0,
        },
      },
      {
        id: 'org-resolved-erp',
        name: 'ERP Co',
        slug: 'erp-co',
        taxNumber: null,
        suspended: false,
        createdAt,
        productLines: ['INTEGRATION', 'ACCOUNTING'],
        accountingMode: null,
        subscription: null,
        users: [],
        orders: [],
        clientRelationships: [],
        _count: {
          users: 2,
          marketplaceConnections: 1,
          orders: 3,
          erpConnections: 2,
        },
      },
    ]);
    prisma.organization.count.mockResolvedValue(2);

    const result = await service.getActiveOrganizations(1, 20);

    expect(result.orgs).toHaveLength(2);
    expect(result.orgs[0]?.accountingMode).toBe(AccountingMode.NATIVE);
    expect(result.orgs[1]?.accountingMode).toBe(AccountingMode.EXTERNAL_ERP);
  });
});

describe('AdminService.updateSubscription', () => {
  let service: AdminService;

  const prisma = {
    organization: {
      findFirst: jest.fn(),
    },
    subscription: {
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const platformOrgId = 'platform-org';
  const clientOrgId = 'client-org';
  const subId = 'sub-1';

  const actor = {
    id: 'admin-user',
    organizationId: platformOrgId,
    role: UserRole.SUPER_ADMIN,
    email: 'admin@senkronize.com',
    name: 'Super Admin',
    currentOrgId: platformOrgId,
    isImpersonating: false,
  } as AuthenticatedUser;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (ops: Promise<unknown>[]) => Promise.all(ops),
    );
    prisma.subscription.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(), getOrThrow: jest.fn() },
        },
        { provide: EmailService, useValue: {} },
        { provide: SessionService, useValue: {} },
        { provide: CacheService, useValue: cacheServiceMock },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  it('rejects platform organization subscription changes', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: platformOrgId,
      slug: 'senkronize-platform',
      subscription: {
        id: subId,
        status: SubStatus.ACTIVE,
        trialEndsAt: null,
      },
    });

    await expect(
      service.updateSubscription(
        platformOrgId,
        { status: SubStatus.PAUSED, reason: 'test' },
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates status and writes admin.subscription_updated audit', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: clientOrgId,
      slug: 'demo-musteri',
      subscription: {
        id: subId,
        status: SubStatus.TRIAL,
        trialEndsAt: new Date('2026-06-01T00:00:00.000Z'),
      },
    });

    await service.updateSubscription(
      clientOrgId,
      { status: SubStatus.ACTIVE, reason: 'Müşteri ödeme yaptı' },
      actor,
    );

    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { organizationId: clientOrgId },
      data: { status: SubStatus.ACTIVE },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin.subscription_updated',
        resourceType: 'Subscription',
        resourceId: subId,
        metadata: expect.objectContaining({
          reason: 'Müşteri ödeme yaptı',
          previousStatus: SubStatus.TRIAL,
          newStatus: SubStatus.ACTIVE,
        }),
      }),
    });
  });
});

describe('AdminService.changeAccountingMode', () => {
  let service: AdminService;

  const prisma = {
    organization: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    erpConnection: {
      count: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const platformOrgId = 'platform-org';
  const clientOrgId = 'client-org';

  const actor = {
    id: 'admin-user',
    organizationId: platformOrgId,
    role: UserRole.SUPER_ADMIN,
    email: 'admin@senkronize.com',
    name: 'Super Admin',
    currentOrgId: platformOrgId,
    isImpersonating: false,
  } as AuthenticatedUser;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      async (ops: Promise<unknown>[]) => Promise.all(ops),
    );
    prisma.organization.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});
    prisma.erpConnection.count.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(), getOrThrow: jest.fn() },
        },
        { provide: EmailService, useValue: {} },
        { provide: SessionService, useValue: {} },
        { provide: CacheService, useValue: cacheServiceMock },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  it('throws NotFound when organization is missing', async () => {
    prisma.organization.findFirst.mockResolvedValue(null);

    await expect(
      service.changeAccountingMode(
        clientOrgId,
        AccountingMode.EXTERNAL_ERP,
        'test',
        actor,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects unchanged accounting mode', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: clientOrgId,
      accountingMode: AccountingMode.NATIVE,
    });

    await expect(
      service.changeAccountingMode(
        clientOrgId,
        AccountingMode.NATIVE,
        'test',
        actor,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks NATIVE when active ERP connections exist', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: clientOrgId,
      accountingMode: AccountingMode.EXTERNAL_ERP,
    });
    prisma.erpConnection.count.mockResolvedValue(2);

    await expect(
      service.changeAccountingMode(
        clientOrgId,
        AccountingMode.NATIVE,
        'Müşteri talebi',
        actor,
      ),
    ).rejects.toThrow(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates mode and writes admin.organization_accounting_mode_changed audit', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: clientOrgId,
      accountingMode: AccountingMode.NATIVE,
    });
    prisma.erpConnection.count.mockResolvedValue(0);

    await service.changeAccountingMode(
      clientOrgId,
      AccountingMode.EXTERNAL_ERP,
      'Harici ERP geçişi',
      actor,
    );

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: clientOrgId },
      data: { accountingMode: AccountingMode.EXTERNAL_ERP },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'admin.organization_accounting_mode_changed',
        resourceType: 'Organization',
        resourceId: clientOrgId,
        metadata: expect.objectContaining({
          reason: 'Harici ERP geçişi',
          previousAccountingMode: AccountingMode.NATIVE,
          newAccountingMode: AccountingMode.EXTERNAL_ERP,
          activeErpConnectionCount: 0,
        }),
      }),
    });
  });
});

describe('AdminService.exportPlatformActivityCsv', () => {
  let service: AdminService;

  const prisma = {
    auditLog: { findMany: jest.fn() },
    organization: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(), getOrThrow: jest.fn() },
        },
        { provide: EmailService, useValue: {} },
        { provide: SessionService, useValue: {} },
        { provide: CacheService, useValue: cacheServiceMock },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  it('exports up to 500 rows with Turkish labels and UTF-8 BOM', async () => {
    const createdAt = new Date('2026-05-22T09:15:00.000Z');
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-1',
        action: 'admin.partner_payout_approve',
        resourceType: 'PartnerPayoutRequest',
        resourceId: 'payout-1',
        actorUserId: 'admin-1',
        actorOrgId: 'platform-org',
        impersonatedOrgId: null,
        createdAt,
      },
    ]);
    prisma.organization.findMany.mockResolvedValue([
      { id: 'platform-org', name: 'Senkronize Platform' },
    ]);

    const csv = await service.exportPlatformActivityCsv();

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    );
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Tarih');
    expect(csv).toContain('Partner ödeme talebi onayı');
    expect(csv).toContain('Senkronize Platform');
    expect(csv).toContain('2026-05-22');
  });

  it('returns header-only CSV when no activity rows exist', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.organization.findMany.mockResolvedValue([]);

    const csv = await service.exportPlatformActivityCsv();

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Tarih,Eylem,Kaynak');
    expect(csv.replace(/^\uFEFF/, '').split('\n')).toHaveLength(1);
  });
});
