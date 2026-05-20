import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { QUEUE_MARKETPLACE_PUSH } from '../queue/queue.constants';
import { StockModule } from '../stock/stock.module';

import { ConflictService } from './conflict.service';
import { SyncController } from './sync.controller';

@Module({
  imports: [
    PrismaModule,
    StockModule,
    BullModule.registerQueue({ name: QUEUE_MARKETPLACE_PUSH }),
  ],
  controllers: [SyncController],
  providers: [ConflictService],
  exports: [ConflictService],
})
export class SyncModule {}
