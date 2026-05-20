import { Injectable, Logger } from '@nestjs/common';
import type { NotificationPreference } from '@prisma/client';
import { NotificationType, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email/email.service';
import { InAppNotificationService } from './in-app/in-app-notification.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import type { UpdateNotificationPreferencesDto } from './notification.dto';
import type {
  NotificationEvent,
  NotificationEventType,
} from './notification.types';
import { PushService } from './push/push.service';

function toInAppType(eventType: NotificationEventType): NotificationType {
  switch (eventType) {
    case 'new_order':
      return NotificationType.ORDER_NEW;
    case 'low_stock':
      return NotificationType.STOCK_LOW;
    case 'stock_out':
      return NotificationType.STOCK_OUT;
    case 'sync_error':
      return NotificationType.SYNC_ERROR;
    case 'plan_expiry':
      return NotificationType.SUBSCRIPTION_EXPIRING;
    case 'payment_failed':
      return NotificationType.PAYMENT_FAILED;
    default:
      return NotificationType.SYSTEM;
  }
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly preferencesService: NotificationPreferencesService,
    private readonly inAppService: InAppNotificationService,
    private readonly emailService: EmailService,
    private readonly pushService: PushService,
  ) {}

  async getPreferences(
    userId: string,
    organizationId: string,
  ): Promise<NotificationPreference> {
    return this.preferencesService.getOrCreate(userId, organizationId);
  }

  async updatePreferences(
    userId: string,
    organizationId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreference> {
    return this.preferencesService.update(userId, organizationId, dto);
  }

  async notify(userId: string, event: NotificationEvent): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true, email: true, organizationId: true },
    });
    if (!user?.organizationId) {
      this.logger.warn(`Bildirim atlandı: kullanıcı bulunamadı (${userId})`);
      return;
    }

    const prefs = await this.preferencesService.getOrCreate(
      userId,
      event.organizationId,
    );

    const tasks: Promise<void>[] = [];

    if (prefs.inAppEnabled) {
      tasks.push(
        this.inAppService
          .create({
            organizationId: event.organizationId,
            userId,
            type: toInAppType(event.type),
            title: event.title,
            message: event.message,
            link: event.link,
            metadata: event.data,
          })
          .then(() => undefined),
      );
    }

    if (prefs.emailEnabled && this.isEmailEnabled(prefs, event.type)) {
      if (prefs.digestFrequency === 'realtime') {
        tasks.push(this.emailService.sendEventEmail(user.email, event));
      } else {
        tasks.push(this.queueForDigest(userId, event));
      }
    }

    if (prefs.pushEnabled && this.isPushEnabled(prefs, event.type)) {
      tasks.push(this.pushService.send(userId, event));
    }

    await Promise.allSettled(tasks);
  }

  async sendTestEmail(userId: string, organizationId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { email: true },
    });
    if (!user) {
      return;
    }
    await this.emailService.sendTestNotification(user.email);
  }

  async sendTestPush(userId: string): Promise<void> {
    const orgId = (
      await this.prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { organizationId: true },
      })
    )?.organizationId;
    await this.pushService.send(userId, {
      organizationId: orgId ?? '',
      type: 'system',
      title: 'Test bildirimi',
      message: 'Senkronize push bildirimleri çalışıyor.',
      link: '/settings',
    });
  }

  private isEmailEnabled(
    prefs: NotificationPreference,
    type: NotificationEventType,
  ): boolean {
    switch (type) {
      case 'new_order':
        return prefs.emailNewOrder;
      case 'low_stock':
        return prefs.emailLowStock;
      case 'stock_out':
        return prefs.emailStockOut;
      case 'sync_error':
        return prefs.emailSyncError;
      case 'weekly_report':
        return prefs.emailWeeklyReport;
      case 'ticket_reply':
        return prefs.emailTicketReply;
      case 'plan_expiry':
        return prefs.emailPlanExpiry;
      default:
        return true;
    }
  }

  private isPushEnabled(
    prefs: NotificationPreference,
    type: NotificationEventType,
  ): boolean {
    switch (type) {
      case 'new_order':
        return prefs.pushNewOrder;
      case 'low_stock':
        return prefs.pushLowStock;
      case 'sync_error':
        return prefs.pushSyncError;
      default:
        return false;
    }
  }

  private async queueForDigest(
    userId: string,
    event: NotificationEvent,
  ): Promise<void> {
    await this.prisma.notificationDigestItem.create({
      data: {
        userId,
        organizationId: event.organizationId,
        eventType: event.type,
        title: event.title,
        message: event.message,
        link: event.link ?? null,
        metadata:
          event.data === undefined
            ? undefined
            : (event.data as Prisma.InputJsonValue),
      },
    });
  }

  async getQueuedNotifications(userId: string): Promise<
    {
      id: string;
      eventType: string;
      title: string;
      message: string;
      link: string | null;
      createdAt: Date;
    }[]
  > {
    return this.prisma.notificationDigestItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        eventType: true,
        title: true,
        message: true,
        link: true,
        createdAt: true,
      },
    });
  }

  async clearQueue(userId: string): Promise<void> {
    await this.prisma.notificationDigestItem.deleteMany({
      where: { userId },
    });
  }
}
