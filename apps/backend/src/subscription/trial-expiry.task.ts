import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrialExpiryTask {
  private readonly logger = new Logger(TrialExpiryTask.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkExpiredTrials(): Promise<void> {
    const expired = await this.prisma.subscription.findMany({
      where: {
        status: SubStatus.TRIAL,
        trialEndsAt: { lt: new Date() },
      },
    });

    for (const sub of expired) {
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubStatus.EXPIRED },
      });
      this.logger.log(`Deneme süresi doldu: org=${sub.organizationId}`);
    }
  }
}
