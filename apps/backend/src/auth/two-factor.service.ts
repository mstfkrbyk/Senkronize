import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { authenticator } from '@otplib/preset-default';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import * as QRCode from 'qrcode';

import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { SecurityNotificationService } from '../security/security-notification.service';

import type { AuthenticatedUser } from './auth.types';

const BCRYPT_ROUNDS = 10;
const BACKUP_CODE_COUNT = 8;

function normalizeBackupCodeInput(raw: string): string | null {
  const hex = raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
  if (hex.length !== 16) {
    return null;
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 16)}`;
}

function normalizeTotpInput(raw: string): string {
  return raw.replace(/\s/g, '');
}

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly securityNotification: SecurityNotificationService,
  ) {}

  private generateBackupCodesPlain(): string[] {
    return Array.from({ length: BACKUP_CODE_COUNT }, () => {
      const a = randomBytes(4).toString('hex').toUpperCase();
      const b = randomBytes(4).toString('hex').toUpperCase();
      return `${a}-${b}`;
    });
  }

  async setupTwoFactor(
    userId: string,
  ): Promise<{ secret: string; qrCodeDataUrl: string; backupCodes: string[] }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { email: true, twoFactorEnabled: true },
    });
    if (!user) {
      throw new BadRequestException('Kullanıcı bulunamadı');
    }
    if (user.twoFactorEnabled) {
      throw new ConflictException('İki adımlı doğrulama zaten etkin.');
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'Senkronize', secret);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    const backupCodes = this.generateBackupCodesPlain();
    const hashedCodes = await Promise.all(
      backupCodes.map((code) => bcrypt.hash(code, BCRYPT_ROUNDS)),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: this.encryption.encrypt(secret),
        twoFactorEnabled: false,
        backupCodes: hashedCodes,
      },
    });

    return { secret, qrCodeDataUrl, backupCodes };
  }

  async verifyAndEnableTwoFactor(
    actor: AuthenticatedUser,
    token: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: actor.id, deletedAt: null },
    });
    if (!user?.twoFactorSecret) {
      throw new BadRequestException('2FA kurulumu başlatılmamış');
    }
    if (user.twoFactorEnabled) {
      throw new ConflictException('İki adımlı doğrulama zaten etkin.');
    }
    if (user.backupCodes.length !== BACKUP_CODE_COUNT) {
      throw new BadRequestException('2FA kurulumu yeniden başlatılmalı');
    }

    const decryptedSecret = this.encryption.decrypt(user.twoFactorSecret);
    const totp = normalizeTotpInput(token);
    if (!authenticator.verify({ token: totp, secret: decryptedSecret })) {
      throw new UnauthorizedException('Geçersiz doğrulama kodu');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: actor.id },
        data: { twoFactorEnabled: true },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: actor.isImpersonating ? actor.currentOrgId : null,
          action: 'auth.two_factor_enabled',
          resourceType: 'User',
          resourceId: actor.id,
          metadata: {},
        },
      });
      return u;
    });
    void this.securityNotification.notify2FAStatusChange(updated, true);
  }

  async disableTwoFactor(
    actor: AuthenticatedUser,
    password: string,
    token: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: actor.id, deletedAt: null },
    });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('İki adımlı doğrulama etkin değil');
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Şifre hatalı');
    }

    const ok = await this.verifyCodeForUser(user, token, {
      consumeBackup: true,
    });
    if (!ok) {
      throw new UnauthorizedException('Geçersiz doğrulama kodu');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: actor.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          backupCodes: [],
        },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: actor.isImpersonating ? actor.currentOrgId : null,
          action: 'auth.two_factor_disabled',
          resourceType: 'User',
          resourceId: actor.id,
          metadata: {},
        },
      });
      return u;
    });
    void this.securityNotification.notify2FAStatusChange(updated, false);
  }

  async getBackupCodesInfo(userId: string): Promise<{
    remainingCount: number;
    totalCount: number;
  }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { twoFactorEnabled: true, backupCodes: true },
    });
    if (!user?.twoFactorEnabled) {
      throw new BadRequestException('İki adımlı doğrulama etkin değil');
    }
    return {
      remainingCount: user.backupCodes.length,
      totalCount: BACKUP_CODE_COUNT,
    };
  }

  async regenerateBackupCodes(
    actor: AuthenticatedUser,
    token: string,
  ): Promise<string[]> {
    const user = await this.prisma.user.findFirst({
      where: { id: actor.id, deletedAt: null },
    });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('İki adımlı doğrulama etkin değil');
    }

    const ok = await this.verifyCodeForUser(user, token, {
      consumeBackup: true,
    });
    if (!ok) {
      throw new UnauthorizedException('Geçersiz doğrulama kodu');
    }

    const plainCodes = this.generateBackupCodesPlain();
    const hashedCodes = await Promise.all(
      plainCodes.map((code) => bcrypt.hash(code, BCRYPT_ROUNDS)),
    );

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: actor.id },
        data: { backupCodes: hashedCodes },
      }),
      this.prisma.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: actor.isImpersonating ? actor.currentOrgId : null,
          action: 'auth.two_factor_backup_regenerated',
          resourceType: 'User',
          resourceId: actor.id,
          metadata: {},
        },
      }),
    ]);

    return plainCodes;
  }

  /** Oturum açma sırasında: TOTP veya (isteğe bağlı tüketilen) yedek kod */
  async verifyTokenForLogin(userId: string, rawToken: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }
    return this.verifyCodeForUser(user, rawToken, { consumeBackup: true });
  }

  private async verifyCodeForUser(
    user: {
      id: string;
      twoFactorSecret: string | null;
      backupCodes: string[];
    },
    rawToken: string,
    options: { consumeBackup: boolean },
  ): Promise<boolean> {
    if (!user.twoFactorSecret) {
      return false;
    }

    const secret = this.encryption.decrypt(user.twoFactorSecret);
    const totp = normalizeTotpInput(rawToken);
    if (/^\d{6}$/.test(totp) && authenticator.verify({ token: totp, secret })) {
      return true;
    }

    const normalizedBackup = normalizeBackupCodeInput(rawToken);
    if (!normalizedBackup) {
      return false;
    }

    const { backupCodes } = user;
    for (let i = 0; i < backupCodes.length; i += 1) {
      const match = await bcrypt.compare(normalizedBackup, backupCodes[i]);
      if (match) {
        if (options.consumeBackup) {
          const updatedCodes = backupCodes.filter((_, idx) => idx !== i);
          await this.prisma.user.update({
            where: { id: user.id },
            data: { backupCodes: updatedCodes },
          });
          await this.prisma.auditLog.create({
            data: {
              actorUserId: user.id,
              actorOrgId: 'system',
              impersonatedOrgId: null,
              action: 'auth.two_factor_backup_used',
              resourceType: 'User',
              resourceId: user.id,
              metadata: { remainingCodes: updatedCodes.length },
            },
          });
        }
        return true;
      }
    }
    return false;
  }
}
