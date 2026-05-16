import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { EventModule } from '../event/event.module';
import { PaytrService } from './paytr.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { TrialExpiryTask } from './trial-expiry.task';

@Module({
  imports: [
    HttpModule.register({
      timeout: 25_000,
      maxRedirects: 0,
    }),
    AuthModule,
    EventModule,
  ],
  controllers: [SubscriptionController],
  providers: [PaytrService, SubscriptionService, TrialExpiryTask],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
