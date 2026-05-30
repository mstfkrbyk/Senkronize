import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption/encryption.service';
import { ProductLineGuard } from './guards/product-line.guard';
import { SubscriptionGuard } from './guards/subscription.guard';
import { ProductMatchKeyService } from './product-match-key.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [EncryptionService, SubscriptionGuard, ProductLineGuard, ProductMatchKeyService],
  exports: [EncryptionService, SubscriptionGuard, ProductLineGuard, ProductMatchKeyService],
})
export class CommonModule {}
