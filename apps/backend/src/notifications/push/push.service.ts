import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import type { PushSubscription as WebPushSubscription } from 'web-push';

import { PrismaService } from '../../prisma/prisma.service';
import type { NotificationEvent } from '../notification.types';
import type { SubscribePushDto } from './push.dto';

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  url?: string;
}

type WebPushNamespace = typeof import('web-push');

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private readonly vapidPublicKey: string;
  private readonly vapidPrivateKey: string;
  private webpush: WebPushNamespace | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.vapidPublicKey = this.config.get<string>('VAPID_PUBLIC_KEY')?.trim() ?? '';
    this.vapidPrivateKey = this.config.get<string>('VAPID_PRIVATE_KEY')?.trim() ?? '';
  }

  async onModuleInit(): Promise<void> {
    if (
      !this.vapidPublicKey ||
      !this.vapidPrivateKey ||
      this.vapidPublicKey === 'placeholder' ||
      this.vapidPrivateKey === 'placeholder'
    ) {
      return;
    }
    const wp = await import('web-push');
    wp.setVapidDetails('mailto:support@senkronize.com', this.vapidPublicKey, this.vapidPrivateKey);
    this.webpush = wp;
  }

  getVapidPublicKey(): string | null {
    if (
      !this.vapidPublicKey ||
      this.vapidPublicKey === 'placeholder' ||
      !this.vapidPrivateKey ||
      this.vapidPrivateKey === 'placeholder'
    ) {
      return null;
    }
    return this.vapidPublicKey;
  }

  async saveSubscription(userId: string, dto: SubscribePushDto): Promise<void> {
    const keysJson: Prisma.InputJsonValue = {
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
    };
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: {
        userId,
        endpoint: dto.endpoint,
        keys: keysJson,
      },
      update: {
        userId,
        keys: keysJson,
      },
    });
  }

  async removeSubscription(userId: string, endpoint?: string): Promise<void> {
    if (endpoint) {
      await this.prisma.pushSubscription.deleteMany({
        where: { userId, endpoint },
      });
      return;
    }
    await this.prisma.pushSubscription.deleteMany({
      where: { userId },
    });
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const count = await this.prisma.pushSubscription.count({
      where: { userId },
    });
    return count > 0;
  }

  async send(userId: string, event: NotificationEvent): Promise<void> {
    const subs = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    const panelBase =
      this.config.get<string>('PANEL_URL') ?? 'https://app.senkronize.com';
    const url = event.link
      ? `${panelBase}${event.link.startsWith('/') ? event.link : `/${event.link}`}`
      : panelBase;

    const payload: PushNotificationPayload = {
      title: event.title,
      body: event.message,
      url,
    };

    for (const sub of subs) {
      const keys = sub.keys as { p256dh: string; auth: string };
      await this.sendToSubscription(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: keys.p256dh, auth: keys.auth },
        },
        payload,
      );
    }
  }

  async sendToSubscription(
    subscription: WebPushSubscription,
    payload: PushNotificationPayload,
  ): Promise<void> {
    if (!this.webpush) {
      this.logger.warn(`[PUSH MOCK] ${payload.title}`);
      return;
    }
    try {
      await this.webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (e) {
      this.logger.error(`Push notification failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
