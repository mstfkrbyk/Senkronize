import { BadRequestException, Injectable } from '@nestjs/common';
import type { NotificationPreference } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import type { UpdateNotificationPreferencesDto } from './notification.dto';
import { isDigestFrequency } from './notification.types';

const PREF_PATCH_KEYS = [
  'emailEnabled',
  'emailNewOrder',
  'emailLowStock',
  'emailStockOut',
  'emailSyncError',
  'emailWeeklyReport',
  'emailTicketReply',
  'emailPlanExpiry',
  'pushEnabled',
  'pushNewOrder',
  'pushLowStock',
  'pushSyncError',
  'inAppEnabled',
  'inAppSoundEnabled',
] as const;

type PrefPatchKey = (typeof PREF_PATCH_KEYS)[number];

function buildPreferencePatch(
  dto: UpdateNotificationPreferencesDto,
): Partial<Record<PrefPatchKey, boolean>> & {
  digestFrequency?: string;
  digestHour?: number;
  newOrder?: boolean;
  stockAlert?: boolean;
  syncError?: boolean;
} {
  const patch: Partial<Record<PrefPatchKey, boolean>> & {
    digestFrequency?: string;
    digestHour?: number;
    newOrder?: boolean;
    stockAlert?: boolean;
    syncError?: boolean;
  } = {};

  for (const key of PREF_PATCH_KEYS) {
    if (typeof dto[key] === 'boolean') {
      patch[key] = dto[key];
    }
  }

  if (dto.digestFrequency !== undefined) {
    if (!isDigestFrequency(dto.digestFrequency)) {
      throw new BadRequestException('Geçersiz özet sıklığı.');
    }
    patch.digestFrequency = dto.digestFrequency;
  }

  if (dto.digestHour !== undefined) {
    patch.digestHour = dto.digestHour;
  }

  if (dto.emailNewOrder !== undefined) {
    patch.newOrder = dto.emailNewOrder;
  }
  if (dto.emailLowStock !== undefined) {
    patch.stockAlert = dto.emailLowStock;
  }
  if (dto.emailSyncError !== undefined) {
    patch.syncError = dto.emailSyncError;
  }
  if (dto.pushNewOrder !== undefined && dto.emailNewOrder === undefined) {
    patch.newOrder = dto.pushNewOrder;
  }

  return patch;
}

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(
    userId: string,
    organizationId: string,
  ): Promise<NotificationPreference> {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, organizationId },
      update: {},
    });
  }

  async update(
    userId: string,
    organizationId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreference> {
    const patch = buildPreferencePatch(dto);
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, organizationId, ...patch },
      update: patch,
    });
  }
}
