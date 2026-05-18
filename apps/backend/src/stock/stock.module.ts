import { Module } from '@nestjs/common';

import { InAppNotificationModule } from '../notifications/in-app/in-app-notification.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OutboundWebhookModule } from '../webhook/outbound-webhook.module';
import { WarehouseModule } from '../warehouse/warehouse.module';

import { StockController } from './stock.controller';
import { StockCountService } from './stock-count.service';
import { StockForecastService } from './stock-forecast.service';
import { StockForecastTask } from './stock-forecast.task';
import { StockMovementService } from './stock-movement.service';
import { StockService } from './stock.service';

@Module({
  imports: [PrismaModule, WarehouseModule, InAppNotificationModule, OutboundWebhookModule],
  controllers: [StockController],
  providers: [
    StockService,
    StockMovementService,
    StockCountService,
    StockForecastService,
    StockForecastTask,
  ],
  exports: [StockService, StockMovementService, StockForecastService, WarehouseModule],
})
export class StockModule {}
