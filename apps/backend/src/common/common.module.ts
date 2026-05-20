import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption/encryption.service';
import { ProductLineGuard } from './guards/product-line.guard';
import { SubscriptionGuard } from './guards/subscription.guard';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [EncryptionService, SubscriptionGuard, ProductLineGuard],
  exports: [EncryptionService, SubscriptionGuard, ProductLineGuard],
})
export class CommonModule {}
