import { Module } from '@nestjs/common';

import { MarketplaceConnectionController } from './marketplace-connection.controller';
import { MarketplaceConnectionService } from './marketplace-connection.service';

@Module({
  controllers: [MarketplaceConnectionController],
  providers: [MarketplaceConnectionService],
  exports: [MarketplaceConnectionService],
})
export class MarketplaceConnectionModule {}
