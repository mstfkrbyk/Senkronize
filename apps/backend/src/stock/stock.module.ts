import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { InAppNotificationModule } from '../notifications/in-app/in-app-notification.module';
import { PrismaModule } from '../prisma/prisma.module';
import { QUEUE_MARKETPLACE_PUSH } from '../queue/queue.constants';
import { OutboundWebhookModule } from '../webhook/outbound-webhook.module';
import { WarehouseModule } from '../warehouse/warehouse.module';

import { StockController } from './stock.controller';
import { StockCountService } from './stock-count.service';
import { StockDistributionService } from './stock-distribution.service';
import { StockForecastService } from './stock-forecast.service';
import { StockForecastTask } from './stock-forecast.task';
import { StockMovementService } from './stock-movement.service';
import { StockService } from './stock.service';

@Module({
  imports: [
    PrismaModule,
    WarehouseModule,
    InAppNotificationModule,
    OutboundWebhookModule,
    BullModule.registerQueue({ name: QUEUE_MARKETPLACE_PUSH }),
  ],
  controllers: [StockController],
  providers: [
    StockService,
    StockMovementService,
    StockCountService,
    StockForecastService,
    StockForecastTask,
    StockDistributionService,
  ],
  exports: [
    StockService,
    StockMovementService,
    StockForecastService,
    StockDistributionService,
    WarehouseModule,
  ],
})
export class StockModule {}
