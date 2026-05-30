import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type InAppNotification,
  NotificationType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { InAppService } from '../in-app.service';

import {
  type InAppNotificationListFilter,
  typesForListFilter,
} from '../notification-list-filters';

function visibilityWhere(
  userId: string,
): Pick<Prisma.InAppNotificationWhereInput, 'OR'> {
  return {
    OR: [{ userId: null }, { userId }],
  };
}

/** Geriye dönük uyumluluk — yeni kod InAppService kullanmalı */
@Injectable()
export class InAppNotificationService {
  constructor(
    private readonly inAppService: InAppService,
    private readonly prisma: PrismaService,
  ) {}

  async create(params: {
    organizationId: string;
    userId?: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }): Promise<InAppNotification> {
    return this.inAppService.createForOrg(params);
  }

  async getUnread(
    organizationId: string,
    userId: string,
  ): Promise<InAppNotification[]> {
    const result = await this.inAppService.getPaginatedForOrg(
      organizationId,
      userId,
      { page: 1, limit: 100, unreadOnly: true },
    );
    return result.items;
  }

  async getAll(
    organizationId: string,
    userId: string,
    page: number,
    limit: number,
    filter: InAppNotificationListFilter,
  ): Promise<{ data: InAppNotification[]; total: number }> {
    const types = typesForListFilter(filter);
    const where: Prisma.InAppNotificationWhereInput = {
      organizationId,
      ...visibilityWhere(userId),
      ...(filter === 'unread' ? { isRead: false } : {}),
      ...(types !== undefined
        ? { type: { in: types.length > 0 ? types : [] } }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.inAppNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.inAppNotification.count({ where }),
    ]);
    return { data, total };
  }

  async markAsRead(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<void> {
    await this.inAppService.markAsReadForOrg(id, organizationId, userId);
  }

  async markAllAsRead(organizationId: string, userId: string): Promise<void> {
    await this.inAppService.markAllAsReadForOrg(organizationId, userId);
  }

  async getUnreadCount(organizationId: string, userId: string): Promise<number> {
    return this.inAppService.getUnreadCountForOrg(organizationId, userId);
  }

  async deleteNotification(
    id: string,
    organizationId: string,
    userId: string,
  ): Promise<void> {
    const row = await this.prisma.inAppNotification.findFirst({
      where: { id, organizationId, ...visibilityWhere(userId) },
    });
    if (!row) {
      throw new NotFoundException('Bildirim bulunamadı');
    }
    await this.prisma.inAppNotification.delete({ where: { id } });
  }

  async deleteAllForUser(
    organizationId: string,
    userId: string,
  ): Promise<{ deleted: number }> {
    const deleted = await this.inAppService.deleteAllForOrg(
      organizationId,
      userId,
    );
    return { deleted };
  }
}
