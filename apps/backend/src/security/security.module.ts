import { Global, Module } from '@nestjs/common';

import { CommonModule } from '../common/common.module';
import { InAppNotificationModule } from '../notifications/in-app/in-app-notification.module';
import { EmailModule } from '../notifications/email/email.module';
import { PrismaModule } from '../prisma/prisma.module';

import { AnomalyDetectionService } from './anomaly-detection.service';
import { IpGeolocationService } from './ip-geolocation.service';
import { IpBlockService } from './ip-block.service';
import { IpBlockGuard } from '../common/guards/ip-block.guard';
import { SecurityNotificationService } from './security-notification.service';
import { SecurityRequestInterceptor } from './security-request.interceptor';

@Global()
@Module({
  imports: [PrismaModule, CommonModule, EmailModule, InAppNotificationModule],
  providers: [
    IpBlockService,
    IpGeolocationService,
    AnomalyDetectionService,
    SecurityNotificationService,
    IpBlockGuard,
    SecurityRequestInterceptor,
  ],
  exports: [
    IpBlockService,
    IpGeolocationService,
    AnomalyDetectionService,
    SecurityNotificationService,
    IpBlockGuard,
    SecurityRequestInterceptor,
  ],
})
export class SecurityModule {}
