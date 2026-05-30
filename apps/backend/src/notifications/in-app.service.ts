import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type InAppNotification,
  NotificationType,
  Prisma,
} from '@prisma/client';
import type { PaginatedResult } from '@senkronize/shared';

import { PrismaService } from '../prisma/prisma.service';

import { WS_EVENTS } from '../event/event.types';
import { NotificationEmitService } from './notification-emit.service';
import {
  intersectNotificationTypes,
  type InAppNotificationListFilter,
  type InAppNotificationScope,
  typesForListFilter,
  typesForScope,
} from './notification-list-filters';

export type InAppNotificationCategory =
  | 'order'
  | 'stock'
  | 'price'
  | 'sync'
  | 'system'
  | 'security';

function categoryToNotificationType(
  type: InAppNotificationCategory,
): NotificationType {
  switch (type) {
    case 'order':
      return NotificationType.ORDER_NEW;
    case 'stock':
      return NotificationType.STOCK_LOW;
    case 'price':
      return NotificationType.PRICE_UPDATED;
    case 'sync':
      return NotificationType.SYNC_SUCCESS;
    case 'security':
    case 'system':
    default:
      return NotificationType.SYSTEM;
  }
}

function categoryFromNotificationType(type: NotificationType): string {
  switch (type) {
    case NotificationType.ORDER_NEW:
    case NotificationType.ORDER_STATUS_CHANGED:
      return 'order';
    case NotificationType.STOCK_LOW:
    case NotificationType.STOCK_OUT:
      return 'stock';
    case NotificationType.PRICE_UPDATED:
    case NotificationType.BUYBOX_WON:
    case NotificationType.BUYBOX_LOST:
      return 'price';
    case NotificationType.SYNC_SUCCESS:
    case NotificationType.SYNC_ERROR:
      return 'sync';
    default:
      return 'system';
  }
}

function visibilityWhere(
  userId: string,
): Pick<Prisma.InAppNotificationWhereInput, 'OR'> {
  return {
    OR: [{ userId: null }, { userId }],
  };
}

@Injectable()
export class InAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationEmit: NotificationEmitService,
  ) {}

  async create(
    userId: string,
    data: {
      type: InAppNotificationCategory;
      title: string;
      body: string;
      link?: string;
      orgId: string;
    },
  ): Promise<InAppNotification> {
    const notification = await this.prisma.inAppNotification.create({
      data: {
        organizationId: data.orgId,
        userId,
        type: categoryToNotificationType(data.type),
        title: data.title,
        message: data.body,
        link: data.link ?? null,
      },
    });

    this.notificationEmit.emitInAppNotification(userId, {
      id: notification.id,
      type: categoryFromNotificationType(notification.type),
      title: notification.title,
      body: notification.message,
      link: notification.link,
    });

    this.notificationEmit.emitLegacy(data.orgId, WS_EVENTS.NOTIFICATION_NEW, {
      id: notification.id,
      organizationId: notification.organizationId,
      userId: notification.userId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    });

    return notification;
  }

  async createForOrg(params: {
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

    const payload = {
      id: notification.id,
      type: categoryFromNotificationType(notification.type),
      title: notification.title,
      body: notification.message,
      link: notification.link,
    };

    if (params.userId) {
      this.notificationEmit.emitInAppNotification(params.userId, payload);
    } else {
      this.notificationEmit.emitLegacy(
        params.organizationId,
        WS_EVENTS.NOTIFICATION_NEW,
        {
          id: notification.id,
          organizationId: notification.organizationId,
          userId: notification.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          link: notification.link,
          isRead: notification.isRead,
          createdAt: notification.createdAt.toISOString(),
        },
      );
    }

    return notification;
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    const row = await this.prisma.inAppNotification.findFirst({
      where: { id: notificationId, ...visibilityWhere(userId) },
    });
    if (!row) {
      throw new NotFoundException('Bildirim bulunamadı');
    }
    await this.prisma.inAppNotification.update({
      where: { id: notificationId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.inAppNotification.updateMany({
      where: { isRead: false, ...visibilityWhere(userId) },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async deleteAll(userId: string): Promise<void> {
    await this.prisma.inAppNotification.deleteMany({
      where: visibilityWhere(userId),
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.inAppNotification.count({
      where: { isRead: false, ...visibilityWhere(userId) },
    });
  }

  async getPaginated(
    userId: string,
    opts: { page: number; limit: number; unreadOnly?: boolean },
  ): Promise<PaginatedResult<InAppNotification>> {
    const where: Prisma.InAppNotificationWhereInput = {
      ...visibilityWhere(userId),
      ...(opts.unreadOnly ? { isRead: false } : {}),
    };
    const page = opts.page;
    const pageSize = opts.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.inAppNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.inAppNotification.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async markAsReadForOrg(
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

  async markAllAsReadForOrg(organizationId: string, userId: string): Promise<void> {
    await this.prisma.inAppNotification.updateMany({
      where: {
        organizationId,
        isRead: false,
        ...visibilityWhere(userId),
      },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async getUnreadCountForOrg(
    organizationId: string,
    userId: string,
  ): Promise<number> {
    return this.prisma.inAppNotification.count({
      where: {
        organizationId,
        isRead: false,
        ...visibilityWhere(userId),
      },
    });
  }

  async getPaginatedForOrg(
    organizationId: string,
    userId: string,
    opts: {
      page: number;
      limit: number;
      unreadOnly?: boolean;
      filter?: InAppNotificationListFilter;
      scope?: InAppNotificationScope;
    },
  ): Promise<PaginatedResult<InAppNotification>> {
    const unreadOnly =
      opts.unreadOnly === true || opts.filter === 'unread';
    const typeIn = intersectNotificationTypes(
      typesForListFilter(opts.filter),
      typesForScope(opts.scope),
    );
    const where: Prisma.InAppNotificationWhereInput = {
      organizationId,
      ...visibilityWhere(userId),
      ...(unreadOnly ? { isRead: false } : {}),
      ...(typeIn !== undefined
        ? { type: { in: typeIn.length > 0 ? typeIn : [] } }
        : {}),
    };
    const page = opts.page;
    const pageSize = opts.limit;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.inAppNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.inAppNotification.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  async deleteAllForOrg(
    organizationId: string,
    userId: string,
  ): Promise<number> {
    const res = await this.prisma.inAppNotification.deleteMany({
      where: { organizationId, ...visibilityWhere(userId) },
    });
    return res.count;
  }
}
