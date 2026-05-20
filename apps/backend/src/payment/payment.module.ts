import { Module, forwardRef } from '@nestjs/common';

import { SubscriptionModule } from '../subscription/subscription.module';
import { IyzicoService } from './iyzico.service';
import { PaymentWebhookController } from './payment-webhook.controller';

@Module({
  imports: [forwardRef(() => SubscriptionModule)],
  controllers: [PaymentWebhookController],
  providers: [IyzicoService],
  exports: [IyzicoService],
})
export class PaymentModule {}
