import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';
import { JwtModule } from '@nestjs/jwt';

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
import { ListingPushModule } from './listing-push.module';
import { ListingSyncService } from './listing-sync.service';
import { SyncController } from './sync.controller';
import { SyncGateway } from './sync-gateway';
import { SyncLogService } from './sync-log.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '15m') as NonNullable<JwtSignOptions['expiresIn']>,
        },
      }),
      inject: [ConfigService],
    }),
    PrismaModule,
    StockModule,
    ApiKeyModule,
    EventModule,
    AdaptersCommonModule,
    MarketplaceConnectionModule,
    SyncStatusModule,
    ListingPushModule,
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
  exports: [ConflictService, SyncLogService, ListingPushModule, ListingSyncService, SyncGateway],
})
export class SyncModule {}
