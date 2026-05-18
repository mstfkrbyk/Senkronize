import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type InAppNotification,
  NotificationType,
  Prisma,
} from '@prisma/client';

import { EventService } from '../../event/event.service';
import { WS_EVENTS } from '../../event/event.types';
import { PrismaService } from '../../prisma/prisma.service';

import type { InAppNotificationListFilter } from './in-app-notification.dto';

function visibilityWhere(
  userId: string,
): Pick<Prisma.InAppNotificationWhereInput, 'OR'> {
  return {
    OR: [{ userId: null }, { userId }],
  };
}

function filterTypes(
  filter: InAppNotificationListFilter,
): NotificationType[] | undefined {
  switch (filter) {
    case 'unread':
    case 'all':
      return undefined;
    case 'order':
      return [NotificationType.ORDER_NEW, NotificationType.ORDER_STATUS_CHANGED];
    case 'stock':
      return [NotificationType.STOCK_LOW, NotificationType.STOCK_OUT];
    case 'error':
      return [NotificationType.SYNC_ERROR, NotificationType.PAYMENT_FAILED];
    default:
      return undefined;
  }
}

@Injectable()
export class InAppNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
  ) {}

  private serializeForSocket(
    notification: InAppNotification,
  ): Record<string, unknown> {
    return {
      id: notification.id,
      organizationId: notification.organizationId,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      isRead: notification.isRead,
      readAt: notification.readAt?.toISOString() ?? null,
      metadata: notification.metadata,
      createdAt: notification.createdAt.toISOString(),
    };
  }

  async create(params: {
    organizationId: string;
    userId?: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }): Promise<InAppNotification> {
    const notification = await this.prisma.inAppNotification.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId ?? null,
        type: params.type,
        title: params.title,
        message: params.message,
        link: params.link ?? null,
        metadata:
          params.metadata === undefined
            ? undefined
            : (params.metadata as Prisma.InputJsonValue),
      },
    });
    this.eventService.emit(
      params.organizationId,
      WS_EVENTS.NOTIFICATION_NEW,
      this.serializeForSocket(notification),
    );
    return notification;
  }

  async getUnread(
    organizationId: string,
    userId: string,
  ): Promise<InAppNotification[]> {
    return this.prisma.inAppNotification.findMany({
      where: {
        organizationId,
        isRead: false,
        ...visibilityWhere(userId),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getAll(
    organizationId: string,
    userId: string,
    page: number,
    limit: number,
    filter: InAppNotificationListFilter,
  ): Promise<{ data: InAppNotification[]; total: number }> {
    const types = filterTypes(filter);
    const where: Prisma.InAppNotificationWhereInput = {
      organizationId,
      ...visibilityWhere(userId),
      ...(filter === 'unread' ? { isRead: false } : {}),
      ...(types && types.length > 0 ? { type: { in: types } } : {}),
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
    const row = await this.prisma.inAppNotification.findFirst({
      where: { id, organizationId, ...visibilityWhere(userId) },
    });
    if (!row) {
      throw new NotFoundException('Bildirim bulunamadı');
    }
    await this.prisma.inAppNotification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(organizationId: string, userId: string): Promise<void> {
    await this.prisma.inAppNotification.updateMany({
      where: {
        organizationId,
        isRead: false,
        ...visibilityWhere(userId),
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getUnreadCount(organizationId: string, userId: string): Promise<number> {
    return this.prisma.inAppNotification.count({
      where: {
        organizationId,
        isRead: false,
        ...visibilityWhere(userId),
      },
    });
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
    const res = await this.prisma.inAppNotification.deleteMany({
      where: {
        organizationId,
        ...visibilityWhere(userId),
      },
    });
    return { deleted: res.count };
  }
}
