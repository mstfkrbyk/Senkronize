import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type NotificationPreference,
  Prisma,
  UserRole,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsQueryDto } from './audit-logs-query.dto';
import {
  InviteUserDto,
  UpdateNotificationPreferencesDto,
  UpdateUserRoleDto,
} from './users.dto';

const BCRYPT_ROUNDS = 10;

export interface AuditLogListItem {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface AuditLogsPageResult {
  logs: AuditLogListItem[];
  total: number;
  page: number;
  limit: number;
}

function metadataToRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function buildAuditActionWhere(
  actionFilter: string | undefined,
): Prisma.StringFilter | undefined {
  const rawAction =
    typeof actionFilter === 'string' ? actionFilter.trim() : '';
  if (rawAction.length === 0) {
    return undefined;
  }
  return rawAction.endsWith('*')
    ? { startsWith: rawAction.slice(0, -1) }
    : { equals: rawAction };
}

const SYNC_QUEUE_JOB_NAMES = [
  'pull-orders',
  'pull-listings',
  'push-stock',
  'push-price',
] as const;

function buildSyncAuditWhere(): Prisma.AuditLogWhereInput {
  return {
    OR: [
      { action: { startsWith: 'sync_' } },
      {
        AND: [
          { action: 'queue.job_failed' },
          {
            OR: SYNC_QUEUE_JOB_NAMES.map((name) => ({
              metadata: { path: ['jobName'], equals: name },
            })),
          },
        ],
      },
    ],
  };
}

const NOTIFICATION_PREF_BOOLEAN_KEYS = [
  'newOrder',
  'stockAlert',
  'paymentAlert',
  'syncError',
  'emailEnabled',
  'smsEnabled',
  'pushEnabled',
] as const;

type NotificationPrefBooleanKey = (typeof NOTIFICATION_PREF_BOOLEAN_KEYS)[number];

const NOTIFICATION_PREF_DEFAULTS: Record<NotificationPrefBooleanKey, boolean> =
  {
    newOrder: true,
    stockAlert: true,
    paymentAlert: true,
    syncError: true,
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: false,
  };

function booleanPatchFromDto(
  dto: UpdateNotificationPreferencesDto,
): Partial<Record<NotificationPrefBooleanKey, boolean>> {
  const patch: Partial<Record<NotificationPrefBooleanKey, boolean>> = {};
  for (const key of NOTIFICATION_PREF_BOOLEAN_KEYS) {
    if (typeof dto[key] === 'boolean') {
      patch[key] = dto[key];
    }
  }
  return patch;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async getAuditLog(
    organizationId: string,
    limit: number,
    actionFilter?: string,
    syncOnly?: boolean,
  ): Promise<AuditLogListItem[]> {
    const take = Math.min(Math.max(limit, 1), 100);
    const actionWhere = buildAuditActionWhere(actionFilter);

    const tenantWhere: Prisma.AuditLogWhereInput = {
      OR: [
        { actorOrgId: organizationId },
        { impersonatedOrgId: organizationId },
      ],
    };

    const clauses: Prisma.AuditLogWhereInput[] = [tenantWhere];
    if (syncOnly === true) {
      clauses.push(buildSyncAuditWhere());
    }
    if (actionWhere) {
      clauses.push({ action: actionWhere });
    }

    const where: Prisma.AuditLogWhereInput =
      clauses.length === 1 ? clauses[0] : { AND: clauses };

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });

    const userIds = [...new Set(logs.map((l) => l.actorUserId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return logs.map((l) => {
      const u = userMap.get(l.actorUserId);
      return {
        id: l.id,
        action: l.action,
        resource: l.resourceType,
        resourceId: l.resourceId,
        userId: l.actorUserId,
        userEmail: u?.email ?? null,
        userName: u?.name ?? null,
        createdAt: l.createdAt.toISOString(),
        metadata: metadataToRecord(l.metadata),
      };
    });
  }

  async getAuditLogsPage(
    organizationId: string,
    query: AuditLogsQueryDto,
  ): Promise<AuditLogsPageResult> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const skip = (page - 1) * limit;

    const actionWhere = buildAuditActionWhere(query.action);

    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (query.from) {
      const from = new Date(query.from);
      if (!Number.isNaN(from.getTime())) {
        createdAtFilter.gte = from;
      }
    }
    if (query.to) {
      const to = new Date(query.to);
      if (!Number.isNaN(to.getTime())) {
        createdAtFilter.lte = to;
      }
    }

    const emailTrim = query.userEmail?.trim();
    let actorUserIn: Prisma.AuditLogWhereInput | undefined;
    if (emailTrim && emailTrim.length > 0) {
      const orgMembers = await this.prisma.user.findMany({
        where: {
          organizationId,
          deletedAt: null,
          email: { contains: emailTrim, mode: 'insensitive' },
        },
        select: { id: true },
      });
      const impersonationActorRows = await this.prisma.auditLog.findMany({
        where: { impersonatedOrgId: organizationId },
        select: { actorUserId: true },
        distinct: ['actorUserId'],
      });
      const impersonationActorIds = [
        ...new Set(impersonationActorRows.map((r) => r.actorUserId)),
      ];
      let partnerMatchIds: string[] = [];
      if (impersonationActorIds.length > 0) {
        partnerMatchIds = (
          await this.prisma.user.findMany({
            where: {
              id: { in: impersonationActorIds },
              deletedAt: null,
              email: { contains: emailTrim, mode: 'insensitive' },
            },
            select: { id: true },
          })
        ).map((u) => u.id);
      }
      const allowed = [
        ...new Set([...orgMembers.map((u) => u.id), ...partnerMatchIds]),
      ];
      if (allowed.length === 0) {
        return { logs: [], total: 0, page, limit };
      }
      actorUserIn = { actorUserId: { in: allowed } };
    }

    const where: Prisma.AuditLogWhereInput = {
      AND: [
        {
          OR: [
            { actorOrgId: organizationId },
            { impersonatedOrgId: organizationId },
          ],
        },
        ...(actionWhere ? [{ action: actionWhere }] : []),
        ...(Object.keys(createdAtFilter).length > 0
          ? [{ createdAt: createdAtFilter }]
          : []),
        ...(actorUserIn ? [actorUserIn] : []),
      ],
    };

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const userIds = [...new Set(logs.map((l) => l.actorUserId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const items: AuditLogListItem[] = logs.map((l) => {
      const u = userMap.get(l.actorUserId);
      return {
        id: l.id,
        action: l.action,
        resource: l.resourceType,
        resourceId: l.resourceId,
        userId: l.actorUserId,
        userEmail: u?.email ?? null,
        userName: u?.name ?? null,
        createdAt: l.createdAt.toISOString(),
        metadata: metadataToRecord(l.metadata),
      };
    });

    return { logs: items, total, page, limit };
  }

  async list(organizationId: string) {
    return this.prisma.user.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
  }

  async invite(organizationId: string, dto: InviteUserDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Bu e-posta adresi zaten kayıtlı.');
    }

    const plainPassword = randomBytes(24).toString('base64url');
    const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
    const displayName = dto.name?.trim() || email.split('@')[0] || 'Kullanıcı';

    const user = await this.prisma.user.create({
      data: {
        organizationId,
        email,
        name: displayName,
        passwordHash,
        role: dto.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return {
      ...user,
      message:
        'Kullanıcı oluşturuldu. E-posta daveti Faz 1 sonunda etkinleşecek.',
    };
  }

  async updateRole(
    organizationId: string,
    actorUserId: string,
    targetUserId: string,
    dto: UpdateUserRoleDto,
  ) {
    if (actorUserId === targetUserId) {
      throw new BadRequestException('Kendi rolünüzü bu uçtan değiştiremezsiniz.');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId, deletedAt: null },
    });
    if (!target) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }

    if (target.role === UserRole.OWNER && dto.role !== UserRole.OWNER) {
      const owners = await this.prisma.user.count({
        where: {
          organizationId,
          role: UserRole.OWNER,
          deletedAt: null,
        },
      });
      if (owners <= 1) {
        throw new BadRequestException('Son sahip kullanıcının rolü değiştirilemez.');
      }
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: { role: dto.role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true,
      },
    });
  }

  async softDelete(
    organizationId: string,
    actorUserId: string,
    targetUserId: string,
  ): Promise<void> {
    if (actorUserId === targetUserId) {
      throw new BadRequestException('Kendi hesabınızı bu uçtan silemezsiniz.');
    }

    const target = await this.prisma.user.findFirst({
      where: { id: targetUserId, organizationId, deletedAt: null },
    });
    if (!target) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }
    if (target.role === UserRole.OWNER) {
      throw new ForbiddenException('Sahip kullanıcı silinemez.');
    }

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { deletedAt: new Date() },
    });
  }

  async getNotificationPreferences(
    userId: string,
    organizationId: string,
  ): Promise<NotificationPreference> {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, organizationId },
      update: {},
    });
  }

  async updateNotificationPreferences(
    userId: string,
    organizationId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreference> {
    const patch = booleanPatchFromDto(dto);
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        organizationId,
        ...NOTIFICATION_PREF_DEFAULTS,
        ...patch,
      },
      update: patch,
    });
  }

  async requestDataExport(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const [user, orders, listings, org] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
      }),
      this.prisma.order.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.listing.count({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
        select: { name: true },
      }),
    ]);

    if (!user) {
      throw new NotFoundException('Kullanıcı bulunamadı.');
    }

    await this.prisma.auditLog.create({
      data: {
        actorUserId: userId,
        actorOrgId: user.organizationId,
        impersonatedOrgId:
          user.organizationId === organizationId ? null : organizationId,
        action: 'DATA_EXPORT_REQUESTED',
        resourceType: 'User',
        resourceId: userId,
        metadata: { orderCount: orders, listingCount: listings },
      },
    });

    await this.notificationService.dispatch({
      organizationId,
      userId,
      channel: 'email',
      template: 'welcome',
      payload: {
        orgName: org?.name ?? 'Senkronize',
        userEmail: user.email,
        email: user.email,
      },
    });
  }
}
