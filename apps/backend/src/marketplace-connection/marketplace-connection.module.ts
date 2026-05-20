import { Module } from '@nestjs/common';

import { ConnectionHealthModule } from '../connection-health/connection-health.module';
import { MarketplaceOAuthModule } from '../common/oauth/marketplace-oauth.module';
import { SubscriptionModule } from '../subscription/subscription.module';

import { MarketplaceConnectionController } from './marketplace-connection.controller';
import { MarketplaceConnectionService } from './marketplace-connection.service';
import { TokenRefreshService } from './token-refresh.service';

@Module({
  imports: [SubscriptionModule, ConnectionHealthModule, MarketplaceOAuthModule],
  controllers: [MarketplaceConnectionController],
  providers: [MarketplaceConnectionService, TokenRefreshService],
  exports: [MarketplaceConnectionService, TokenRefreshService],
})
export class MarketplaceConnectionModule {}
