import { Module, forwardRef } from '@nestjs/common';

import { EncryptionModule } from '../common/encryption/encryption.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { IyzicoService } from './iyzico.service';
import { PaymentWebhookController } from './payment-webhook.controller';

@Module({
  imports: [
    PrismaModule,
    EncryptionModule,
    forwardRef(() => SubscriptionModule),
  ],
  controllers: [PaymentWebhookController],
  providers: [IyzicoService],
  exports: [IyzicoService],
})
export class PaymentModule {}
