import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { AdaptersCommonModule } from '../adapters/common/adapters-common.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { EventModule } from '../event/event.module';
import { MarketplaceConnectionModule } from '../marketplace-connection/marketplace-connection.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  QUEUE_LISTING_SYNC,
  QUEUE_MARKETPLACE_PUSH,
} from '../queue/queue.constants';
import { StockModule } from '../stock/stock.module';
import { SyncStatusModule } from '../sync-status/sync-status.module';

import { ConflictService } from './conflict.service';
import { ListingSyncService } from './listing-sync.service';
import { SyncController } from './sync.controller';
import { SyncGateway } from './sync-gateway';
import { SyncLogService } from './sync-log.service';

@Module({
  imports: [
    PrismaModule,
    StockModule,
    ApiKeyModule,
    EventModule,
    AdaptersCommonModule,
    MarketplaceConnectionModule,
    SyncStatusModule,
    BullModule.registerQueue(
      { name: QUEUE_MARKETPLACE_PUSH },
      { name: QUEUE_LISTING_SYNC },
    ),
  ],
  controllers: [SyncController],
  providers: [
    ConflictService,
    SyncLogService,
    ListingSyncService,
    SyncGateway,
  ],
  exports: [ConflictService, SyncLogService, ListingSyncService, SyncGateway],
})
export class SyncModule {}
