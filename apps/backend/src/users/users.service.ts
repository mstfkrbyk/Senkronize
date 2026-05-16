import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { InviteUserDto, UpdateUserRoleDto } from './users.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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
