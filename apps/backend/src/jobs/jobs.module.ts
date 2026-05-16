import { Module } from '@nestjs/common';

import { MarketplaceConnectionModule } from '../marketplace-connection/marketplace-connection.module';
import { SyncStatusModule } from '../sync-status/sync-status.module';

import { MarketplacePullProcessor } from './marketplace-pull.processor';

@Module({
  imports: [SyncStatusModule, MarketplaceConnectionModule],
  providers: [MarketplacePullProcessor],
})
export class JobsModule {}
