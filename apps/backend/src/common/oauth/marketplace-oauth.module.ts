import { Module } from '@nestjs/common';

import { AdaptersCommonModule } from '../../adapters/common/adapters-common.module';

import { MarketplaceOAuthService } from './marketplace-oauth.service';

@Module({
  imports: [AdaptersCommonModule],
  providers: [MarketplaceOAuthService],
  exports: [MarketplaceOAuthService],
})
export class MarketplaceOAuthModule {}
