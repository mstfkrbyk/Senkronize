import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption/encryption.service';
import { SubscriptionGuard } from './guards/subscription.guard';

@Global()
@Module({
  providers: [EncryptionService, SubscriptionGuard],
  exports: [EncryptionService, SubscriptionGuard],
})
export class CommonModule {}
