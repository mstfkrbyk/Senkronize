import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { ErpModule } from '../erp/erp.module';
import { InAppNotificationModule } from '../notifications/in-app/in-app-notification.module';
import { PrismaModule } from '../prisma/prisma.module';
import {
  QUEUE_LISTING_SYNC,
  QUEUE_MARKETPLACE_PUSH,
} from '../queue/queue.constants';
import { OutboundWebhookModule } from '../webhook/outbound-webhook.module';
import { WarehouseModule } from '../warehouse/warehouse.module';

import { StockController } from './stock.controller';
import { StockCountPdfService } from './stock-count-pdf.service';
import { StockCountService } from './stock-count.service';
import { StockDistributionService } from './stock-distribution.service';
import { StockForecastService } from './stock-forecast.service';
import { StockForecastTask } from './stock-forecast.task';
import { StockMovementService } from './stock-movement.service';
import { StockTransferService } from './stock-transfer.service';
import { StockService } from './stock.service';

@Module({
  imports: [
    PrismaModule,
    WarehouseModule,
    ErpModule,
    InAppNotificationModule,
    OutboundWebhookModule,
    BullModule.registerQueue(
      { name: QUEUE_MARKETPLACE_PUSH },
      { name: QUEUE_LISTING_SYNC },
    ),
  ],
  controllers: [StockController],
  providers: [
    StockService,
    StockMovementService,
    StockCountService,
    StockCountPdfService,
    StockTransferService,
    StockForecastService,
    StockForecastTask,
    StockDistributionService,
  ],
  exports: [
    StockService,
    StockMovementService,
    StockForecastService,
    StockDistributionService,
    StockTransferService,
    WarehouseModule,
  ],
})
export class StockModule {}
