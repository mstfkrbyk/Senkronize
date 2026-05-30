import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PartnerLinkStatus, PartnerStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { NotificationService } from '../notification/notification.service';
import { InAppNotificationService } from '../notifications/in-app/in-app-notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { PartnerLinkService } from './partner-link.service';
import { PartnerService } from './partner.service';

describe('PartnerLinkService.getLinkRequests', () => {
  let service: PartnerLinkService;

  const prisma = {
    partnerLinkRequest: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.partnerLinkRequest.findMany.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnerLinkService,
        { provide: PrismaService, useValue: prisma },
        { provide: PartnerService, useValue: {} },
        { provide: InAppNotificationService, useValue: {} },
        { provide: NotificationService, useValue: { dispatch: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:5173') },
        },
      ],
    }).compile();

    service = module.get(PartnerLinkService);
  });

  it('returns empty array when prisma resolves null', async () => {
    const rows = await service.getLinkRequests(PartnerLinkStatus.PENDING);

    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(0);
  });

  it('returns link requests when prisma resolves rows', async () => {
    prisma.partnerLinkRequest.findMany.mockResolvedValue([
      {
        id: 'link-1',
        status: PartnerLinkStatus.PENDING,
        clientOrg: { id: 'c1', name: 'Müşteri', slug: 'musteri' },
        partnerOrg: { id: 'p1', name: 'Partner', slug: 'partner' },
      },
    ]);

    const rows = await service.getLinkRequests(PartnerLinkStatus.PENDING);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe('link-1');
    expect(prisma.partnerLinkRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: PartnerLinkStatus.PENDING } }),
    );
  });
});

describe('PartnerLinkService.approveLinkRequest', () => {
  let service: PartnerLinkService;

  const requestId = 'link-req-1';
  const adminUserId = 'admin-user';
  const clientOrgId = 'client-org';
  const partnerOrgId = 'partner-org';

  const partnerService = {
    getPartnerProfile: jest.fn(),
  };
  const inAppNotificationService = {
    create: jest.fn().mockResolvedValue(undefined),
  };
  const notificationService = {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };

  const prisma = {
    partnerLinkRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    partnerRelationship: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(),
  };

  const pendingRequest = {
    id: requestId,
    clientOrgId,
    partnerOrgId,
    status: PartnerLinkStatus.PENDING,
    clientOrg: { name: 'Müşteri A.Ş.' },
    partnerOrg: { name: 'Partner A.Ş.' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    partnerService.getPartnerProfile.mockResolvedValue({
      commissionRate: { toNumber: () => 12 },
    });
    prisma.partnerLinkRequest.findUnique.mockResolvedValue(pendingRequest);
    prisma.partnerRelationship.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma),
    );
    prisma.partnerLinkRequest.update.mockResolvedValue({});
    prisma.partnerRelationship.upsert.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnerLinkService,
        { provide: PrismaService, useValue: prisma },
        { provide: PartnerService, useValue: partnerService },
        { provide: InAppNotificationService, useValue: inAppNotificationService },
        { provide: NotificationService, useValue: notificationService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:5173') },
        },
      ],
    }).compile();

    service = module.get(PartnerLinkService);
  });

  it('approves pending request and upserts active partner relationship', async () => {
    await service.approveLinkRequest(requestId, adminUserId);

    expect(prisma.partnerLinkRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: requestId },
        data: expect.objectContaining({
          status: PartnerLinkStatus.APPROVED,
          reviewedBy: adminUserId,
        }),
      }),
    );
    expect(prisma.partnerRelationship.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          partnerOrgId,
          clientOrgId,
          status: PartnerStatus.ACTIVE,
          canImpersonate: true,
        }),
      }),
    );
    expect(inAppNotificationService.create).toHaveBeenCalledTimes(2);
  });

  it('throws NotFound when request is missing', async () => {
    prisma.partnerLinkRequest.findUnique.mockResolvedValue(null);

    await expect(
      service.approveLinkRequest(requestId, adminUserId),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws when request is already processed', async () => {
    prisma.partnerLinkRequest.findUnique.mockResolvedValue({
      ...pendingRequest,
      status: PartnerLinkStatus.REJECTED,
    });

    await expect(
      service.approveLinkRequest(requestId, adminUserId),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('skips relationship upsert when already active', async () => {
    prisma.partnerRelationship.findUnique.mockResolvedValue({
      status: PartnerStatus.ACTIVE,
    });

    await service.approveLinkRequest(requestId, adminUserId);

    expect(prisma.partnerRelationship.upsert).not.toHaveBeenCalled();
  });

  it('upserts relationship with commission rate when not yet active', async () => {
    prisma.partnerRelationship.findUnique.mockResolvedValue({
      status: PartnerStatus.PENDING,
    });

    await service.approveLinkRequest(requestId, adminUserId);

    expect(partnerService.getPartnerProfile).toHaveBeenCalledWith(partnerOrgId);
    expect(prisma.partnerRelationship.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          commissionPct: expect.objectContaining({
            toNumber: expect.any(Function),
          }),
        }),
        update: expect.objectContaining({
          commissionPct: expect.objectContaining({
            toNumber: expect.any(Function),
          }),
        }),
      }),
    );
  });
});

describe('PartnerLinkService.rejectLinkRequest', () => {
  let service: PartnerLinkService;

  const requestId = 'link-req-2';
  const adminUserId = 'admin-user';
  const clientOrgId = 'client-org';

  const inAppNotificationService = {
    create: jest.fn().mockResolvedValue(undefined),
  };
  const notificationService = {
    dispatch: jest.fn().mockResolvedValue(undefined),
  };

  const prisma = {
    partnerLinkRequest: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'owner-1', email: 'owner@ornek.com' },
      ]),
    },
  };

  const pendingRequest = {
    id: requestId,
    clientOrgId,
    partnerOrgId: 'partner-org',
    status: PartnerLinkStatus.PENDING,
    clientOrg: { name: 'Müşteri B' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.partnerLinkRequest.findUnique.mockResolvedValue(pendingRequest);
    prisma.partnerLinkRequest.update.mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PartnerLinkService,
        { provide: PrismaService, useValue: prisma },
        { provide: PartnerService, useValue: {} },
        { provide: InAppNotificationService, useValue: inAppNotificationService },
        { provide: NotificationService, useValue: notificationService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:5173') },
        },
      ],
    }).compile();

    service = module.get(PartnerLinkService);
  });

  it('rejects pending request with trimmed admin note', async () => {
    await service.rejectLinkRequest(requestId, adminUserId, '  Uyumsuz sektör  ');

    expect(prisma.partnerLinkRequest.update).toHaveBeenCalledWith({
      where: { id: requestId },
      data: expect.objectContaining({
        status: PartnerLinkStatus.REJECTED,
        adminNote: 'Uyumsuz sektör',
        reviewedBy: adminUserId,
      }),
    });
    expect(inAppNotificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: clientOrgId,
        title: 'Partner bağlantı talebi reddedildi',
      }),
    );
    expect(notificationService.dispatch).toHaveBeenCalled();
  });

  it('throws NotFound when request is missing', async () => {
    prisma.partnerLinkRequest.findUnique.mockResolvedValue(null);

    await expect(
      service.rejectLinkRequest(requestId, adminUserId),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws when request is already approved', async () => {
    prisma.partnerLinkRequest.findUnique.mockResolvedValue({
      ...pendingRequest,
      status: PartnerLinkStatus.APPROVED,
    });

    await expect(
      service.rejectLinkRequest(requestId, adminUserId, 'geç'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.partnerLinkRequest.update).not.toHaveBeenCalled();
  });

  it('rejects without admin note when note is omitted or blank', async () => {
    await service.rejectLinkRequest(requestId, adminUserId);

    expect(prisma.partnerLinkRequest.update).toHaveBeenCalledWith({
      where: { id: requestId },
      data: expect.objectContaining({ adminNote: null }),
    });
    expect(inAppNotificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Partner bağlantı talebiniz admin tarafından reddedildi.',
      }),
    );
  });
});
