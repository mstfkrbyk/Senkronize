import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { StockModule } from '../stock/stock.module';
import { OutboundWebhookModule } from '../webhook/outbound-webhook.module';

import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [PrismaModule, StockModule, OutboundWebhookModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
