import { Module } from '@nestjs/common';

import { ImpersonationModule } from '../impersonation/impersonation.module';
import { NotificationModule } from '../notification/notification.module';
import { InAppNotificationModule } from '../notifications/in-app/in-app-notification.module';
import { PrismaModule } from '../prisma/prisma.module';

import { PartnerController } from './partner.controller';
import { PartnerLinkService } from './partner-link.service';
import { PartnerService } from './partner.service';

@Module({
  imports: [
    PrismaModule,
    NotificationModule,
    ImpersonationModule,
    InAppNotificationModule,
  ],
  controllers: [PartnerController],
  providers: [PartnerService, PartnerLinkService],
  exports: [PartnerService, PartnerLinkService],
})
export class PartnerModule {}
