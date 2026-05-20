import { Module } from '@nestjs/common';

import { ErpModule } from '../erp/erp.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReturnModule } from '../return/return.module';
import { StockModule } from '../stock/stock.module';
import { OutboundWebhookModule } from '../webhook/outbound-webhook.module';

import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { ShippingLabelService } from './shipping-label.service';

@Module({
  imports: [PrismaModule, StockModule, OutboundWebhookModule, InvoiceModule, ReturnModule, ErpModule],
  controllers: [OrderController],
  providers: [OrderService, ShippingLabelService],
  exports: [OrderService],
})
export class OrderModule {}
