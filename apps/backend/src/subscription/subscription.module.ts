import { Module, forwardRef } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { EventModule } from '../event/event.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { InAppNotificationModule } from '../notifications/in-app/in-app-notification.module';
import { PartnerModule } from '../partner/partner.module';
import { PaymentModule } from '../payment/payment.module';
import { OutboundWebhookModule } from '../webhook/outbound-webhook.module';
import { PaytrService } from './paytr.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { SubscriptionRenewalTask } from './subscription-renewal.task';
import { TrialExpiryTask } from './trial-expiry.task';
import { TrialService } from './trial.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 25_000,
      maxRedirects: 0,
    }),
    forwardRef(() => PaymentModule),
    InvoiceModule,
    forwardRef(() => AuthModule),
    EventModule,
    InAppNotificationModule,
    PartnerModule,
    OutboundWebhookModule,
  ],
  controllers: [SubscriptionController],
  providers: [
    PaytrService,
    SubscriptionService,
    TrialService,
    TrialExpiryTask,
    SubscriptionRenewalTask,
  ],
  exports: [SubscriptionService, TrialService],
})
export class SubscriptionModule {}
