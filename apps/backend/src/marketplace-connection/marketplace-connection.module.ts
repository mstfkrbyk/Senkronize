import { Module } from '@nestjs/common';

import { SubscriptionModule } from '../subscription/subscription.module';

import { MarketplaceConnectionController } from './marketplace-connection.controller';
import { MarketplaceConnectionService } from './marketplace-connection.service';

@Module({
  imports: [SubscriptionModule],
  controllers: [MarketplaceConnectionController],
  providers: [MarketplaceConnectionService],
  exports: [MarketplaceConnectionService],
})
export class MarketplaceConnectionModule {}
