import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { InviteUserDto, UpdateUserRoleDto } from './users.dto';

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

function metadataToRecord(value: Prisma.JsonValue): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuditLog(
    organizationId: string,
    limit: number,
  ): Promise<AuditLogListItem[]> {
    const take = Math.min(Math.max(limit, 1), 100);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        OR: [
          { actorOrgId: organizationId },
          { impersonatedOrgId: organizationId },
        ],
      },
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
}
