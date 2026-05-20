import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { EventModule } from '../event/event.module';
import { InAppNotificationModule } from '../notifications/in-app/in-app-notification.module';
import { PartnerModule } from '../partner/partner.module';
import { PaymentModule } from '../payment/payment.module';
import { PaytrService } from './paytr.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionRenewalTask } from './subscription-renewal.task';
import { TrialExpiryTask } from './trial-expiry.task';

@Module({
  imports: [
    HttpModule.register({
      timeout: 25_000,
      maxRedirects: 0,
    }),
    forwardRef(() => PaymentModule),
    AuthModule,
    EventModule,
    InAppNotificationModule,
    PartnerModule,
  ],
  controllers: [SubscriptionController],
  providers: [
    PaytrService,
    SubscriptionService,
    TrialExpiryTask,
    SubscriptionRenewalTask,
  ],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
