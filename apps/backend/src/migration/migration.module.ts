import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { CacheModule } from '../common/cache/cache.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QUEUE_DATA_IMPORT } from '../queue/queue.constants';
import { StockModule } from '../stock/stock.module';
import { WarehouseModule } from '../warehouse/warehouse.module';

import { MigrationImportExecutor } from './migration-import.executor';
import { MigrationController } from './migration.controller';
import { MigrationSessionStore } from './migration-session.store';
import { MigrationService } from './migration.service';

@Module({
  imports: [
    PrismaModule,
    CacheModule,
    WarehouseModule,
    StockModule,
    BullModule.registerQueue({ name: QUEUE_DATA_IMPORT }),
  ],
  controllers: [MigrationController],
  providers: [MigrationService, MigrationSessionStore, MigrationImportExecutor],
  exports: [MigrationService],
})
export class MigrationModule {}
