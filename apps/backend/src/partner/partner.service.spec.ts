import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AccountingMode,
  LedgerStatus,
  OrgType,
  PartnerStatus,
} from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { ImpersonationService } from '../impersonation/impersonation.service';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerService } from './partner.service';

describe('PartnerService.getMyClients', () => {
  let service: PartnerService;

  const partnerOrgId = 'partner-org';
  const clientOrgId = 'client-org';

  const prisma = {
    organization: {
      findFirst: jest.fn(),
    },
    partnerRelationship: {
      findMany: jest.fn(),
    },
    order: {
      groupBy: jest.fn(),
    },
    erpConnection: {
      groupBy: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.organization.findFirst.mockResolvedValue({
      id: partnerOrgId,
      type: OrgType.PARTNER,
    });
    prisma.partnerRelationship.findMany.mockResolvedValue([
      {
        id: 'rel-1',
        partnerOrgId,
        clientOrgId,
        invitedEmail: null,
        status: PartnerStatus.ACTIVE,
        commissionPct: '10',
        canImpersonate: true,
        acceptedAt: new Date(),
        createdAt: new Date(),
        inviteToken: null,
        clientOrg: {
          id: clientOrgId,
          name: 'Demo Partner A.Ş.',
          slug: 'demo-partner-musteri',
          createdAt: new Date(),
          productLines: ['BUNDLE'],
          accountingMode: AccountingMode.NATIVE,
        },
      },
    ]);
    prisma.order.groupBy.mockResolvedValue([
      { organizationId: clientOrgId, _count: { _all: 8 } },
    ]);
    prisma.erpConnection.groupBy.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnerService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: {} },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:5173') },
        },
        { provide: ImpersonationService, useValue: {} },
      ],
    }).compile();

    service = module.get(PartnerService);
  });

  it('returns orders30d from order groupBy for each active client', async () => {
    const rows = await service.getMyClients(partnerOrgId);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.orders30d).toBe(8);
    const clientOrg = (
      rows[0] as
        | { clientOrg?: { orgProducts: string[]; accountingMode: AccountingMode } }
        | undefined
    )?.clientOrg;
    expect(clientOrg?.orgProducts).toEqual(['INTEGRATION', 'ACCOUNTING']);
    expect(clientOrg?.accountingMode).toBe(AccountingMode.NATIVE);
    expect(prisma.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['organizationId'],
        where: expect.objectContaining({
          organizationId: { in: [clientOrgId] },
        }),
      }),
    );
  });

  it('returns orders30d as 0 when client has no orders in last 30 days', async () => {
    prisma.order.groupBy.mockResolvedValue([]);

    const rows = await service.getMyClients(partnerOrgId);

    expect(rows[0]?.orders30d).toBe(0);
  });

  it('returns orders30d as 0 for pending invite without client org', async () => {
    prisma.partnerRelationship.findMany.mockResolvedValue([
      {
        id: 'rel-pending',
        partnerOrgId,
        clientOrgId: null,
        invitedEmail: 'bekleyen@ornek.com',
        status: PartnerStatus.PENDING,
        commissionPct: '10',
        canImpersonate: false,
        acceptedAt: null,
        createdAt: new Date(),
        inviteToken: 'tok',
        clientOrg: null,
      },
    ]);

    const rows = await service.getMyClients(partnerOrgId);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.orders30d).toBe(0);
    expect(prisma.order.groupBy).not.toHaveBeenCalled();
  });

  it('throws when org is not PARTNER', async () => {
    prisma.organization.findFirst.mockResolvedValue({
      id: partnerOrgId,
      type: OrgType.DIRECT,
    });

    await expect(service.getMyClients(partnerOrgId)).rejects.toThrow(
      ForbiddenException,
    );
  });
});

describe('PartnerService.listPartnersForAdmin', () => {
  let service: PartnerService;

  const prisma = {
    organization: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.organization.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Partner A',
        slug: 'partner-a',
        createdAt: new Date(),
        partnerProfile: { commissionRate: null },
        _count: { partnerRelationships: null },
      },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnerService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: ImpersonationService, useValue: {} },
      ],
    }).compile();

    service = module.get(PartnerService);
  });

  it('returns array with numeric commissionRate and activeClientCount', async () => {
    const rows = await service.listPartnersForAdmin();

    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.commissionRate).toBe(10);
    expect(rows[0]?.activeClientCount).toBe(0);
  });
});

describe('PartnerService.getDashboard', () => {
  let service: PartnerService;
  const partnerOrgId = 'partner-org';

  const prisma = {
    organization: { findFirst: jest.fn() },
    partnerRelationship: { findMany: jest.fn() },
    commissionLedger: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
    },
    marketplaceConnection: { groupBy: jest.fn() },
    order: { groupBy: jest.fn() },
    auditLog: { findMany: jest.fn() },
    erpConnection: { groupBy: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.organization.findFirst.mockResolvedValue({
      id: partnerOrgId,
      type: OrgType.PARTNER,
    });
    prisma.partnerRelationship.findMany.mockResolvedValue([]);
    prisma.commissionLedger.aggregate.mockResolvedValue({ _sum: { amount: null } });
    prisma.commissionLedger.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnerService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: ImpersonationService, useValue: {} },
      ],
    }).compile();

    service = module.get(PartnerService);
  });

  it('returns empty clients and recentActivities arrays with zero metrics', async () => {
    const dash = await service.getDashboard(partnerOrgId);

    expect(Array.isArray(dash.clients)).toBe(true);
    expect(dash.clients).toHaveLength(0);
    expect(Array.isArray(dash.recentActivities)).toBe(true);
    expect(dash.recentActivities).toHaveLength(0);
    expect(Array.isArray(dash.commissionPctSummary.unique)).toBe(true);
    expect(dash.monthlyCommission).toBe(0);
    expect(dash.totalCommission).toBe(0);
  });
});

describe('PartnerService.getCommissions', () => {
  let service: PartnerService;
  const partnerOrgId = 'partner-org';

  const prisma = {
    organization: { findFirst: jest.fn() },
    commissionLedger: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.organization.findFirst.mockResolvedValue({
      id: partnerOrgId,
      type: OrgType.PARTNER,
    });
    prisma.commissionLedger.findMany.mockResolvedValue(null);
    prisma.commissionLedger.count.mockResolvedValue(null);
    prisma.commissionLedger.aggregate.mockResolvedValue({ _sum: { amount: null } });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnerService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: ImpersonationService, useValue: {} },
      ],
    }).compile();

    service = module.get(PartnerService);
  });

  it('returns items array and numeric pagination fields when prisma returns nullish', async () => {
    const page = await service.getCommissions(partnerOrgId, 1, 20);

    expect(Array.isArray(page.items)).toBe(true);
    expect(page.items).toHaveLength(0);
    expect(page.total).toBe(0);
    expect(page.currentMonthTotal).toBe(0);
  });
});

describe('PartnerService payout requests', () => {
  let service: PartnerService;

  const partnerOrgId = 'partner-org';
  const adminOrgId = 'platform-org';
  const adminUserId = 'admin-user';
  const payoutLogId = 'payout-log-1';

  const prisma = {
    organization: { findFirst: jest.fn(), findMany: jest.fn() },
    auditLog: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findFirstOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    commissionLedger: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const assertPartner = (): void => {
    prisma.organization.findFirst.mockResolvedValue({
      id: partnerOrgId,
      type: OrgType.PARTNER,
      deletedAt: null,
    });
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    assertPartner();
    prisma.commissionLedger.aggregate.mockResolvedValue({
      _sum: { amount: 5000 },
    });
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    prisma.commissionLedger.findMany.mockResolvedValue([
      { id: 'ledger-1', amount: 1500, createdAt: new Date() },
    ]);
    prisma.commissionLedger.update.mockResolvedValue({});
    prisma.organization.findMany.mockResolvedValue([
      { id: partnerOrgId, name: 'Partner A.Ş.' },
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnerService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: ImpersonationService, useValue: {} },
      ],
    }).compile();

    service = module.get(PartnerService);
  });

  it('listPayoutRequestsForAdmin filters by status and attaches partner names', async () => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        id: 'log-pending',
        actorOrgId: partnerOrgId,
        createdAt: new Date('2026-05-20T12:00:00.000Z'),
        metadata: { amountTRY: 1000, status: 'PENDING' },
      },
      {
        id: 'log-approved',
        actorOrgId: partnerOrgId,
        createdAt: new Date('2026-05-19T12:00:00.000Z'),
        metadata: { amountTRY: 500, status: 'APPROVED', reviewedAt: '2026-05-19' },
      },
    ]);

    const pendingOnly = await service.listPayoutRequestsForAdmin('PENDING');
    expect(pendingOnly).toHaveLength(1);
    expect(pendingOnly[0]?.status).toBe('PENDING');
    expect(pendingOnly[0]?.partnerName).toBe('Partner A.Ş.');

    const all = await service.listPayoutRequestsForAdmin();
    expect(all).toHaveLength(2);
  });

  it('requestPayout rejects when a pending request already exists', async () => {
    prisma.auditLog.findFirst.mockResolvedValue({
      id: 'existing',
      metadata: { amountTRY: 200, status: 'PENDING' },
    });

    await expect(
      service.requestPayout(partnerOrgId, adminUserId, 100),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('requestPayout rejects amount above pending commission balance', async () => {
    prisma.auditLog.findFirst.mockResolvedValue(null);
    prisma.commissionLedger.aggregate.mockResolvedValue({
      _sum: { amount: 50 },
    });

    await expect(
      service.requestPayout(partnerOrgId, adminUserId, 100),
    ).rejects.toThrow(BadRequestException);
  });

  it('approvePayoutRequest settles ledger and marks request approved', async () => {
    prisma.auditLog.findFirst.mockResolvedValue({
      id: payoutLogId,
      actorOrgId: partnerOrgId,
      action: 'partner.payout_request',
      metadata: { amountTRY: 1500, status: 'PENDING' },
    });
    prisma.auditLog.findFirstOrThrow.mockResolvedValue({
      id: payoutLogId,
      actorOrgId: partnerOrgId,
      createdAt: new Date(),
      metadata: {
        amountTRY: 1500,
        status: 'APPROVED',
        reviewedAt: '2026-05-22T10:00:00.000Z',
      },
    });
    prisma.auditLog.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});

    const row = await service.approvePayoutRequest(
      payoutLogId,
      adminUserId,
      adminOrgId,
    );

    expect(row.status).toBe('APPROVED');
    expect(row.amountTRY).toBe(1500);
    expect(prisma.commissionLedger.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ledger-1' },
        data: expect.objectContaining({ status: LedgerStatus.SETTLED }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin.partner_payout_approve',
          resourceId: payoutLogId,
        }),
      }),
    );
  });

  it('approvePayoutRequest throws when request is missing', async () => {
    prisma.auditLog.findFirst.mockResolvedValue(null);

    await expect(
      service.approvePayoutRequest(payoutLogId, adminUserId, adminOrgId),
    ).rejects.toThrow(NotFoundException);
  });

  it('approvePayoutRequest throws when request is already processed', async () => {
    prisma.auditLog.findFirst.mockResolvedValue({
      id: payoutLogId,
      actorOrgId: partnerOrgId,
      metadata: { amountTRY: 100, status: 'REJECTED' },
    });

    await expect(
      service.approvePayoutRequest(payoutLogId, adminUserId, adminOrgId),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejectPayoutRequest updates metadata and writes admin audit', async () => {
    prisma.auditLog.findFirst.mockResolvedValue({
      id: payoutLogId,
      actorOrgId: partnerOrgId,
      metadata: { amountTRY: 800, status: 'PENDING' },
    });
    prisma.auditLog.findFirstOrThrow.mockResolvedValue({
      id: payoutLogId,
      actorOrgId: partnerOrgId,
      createdAt: new Date(),
      metadata: {
        amountTRY: 800,
        status: 'REJECTED',
        reviewedAt: '2026-05-22T11:00:00.000Z',
        note: 'Eksik belge',
      },
    });
    prisma.auditLog.update.mockResolvedValue({});
    prisma.auditLog.create.mockResolvedValue({});

    const row = await service.rejectPayoutRequest(
      payoutLogId,
      adminUserId,
      adminOrgId,
      '  Eksik belge  ',
    );

    expect(row.status).toBe('REJECTED');
    expect(prisma.auditLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            status: 'REJECTED',
            note: 'Eksik belge',
          }),
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'admin.partner_payout_reject',
        }),
      }),
    );
    expect(prisma.commissionLedger.update).not.toHaveBeenCalled();
  });
});
