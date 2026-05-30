import { Module } from '@nestjs/common';

import { AccountingModule } from '../accounting/accounting.module';
import { AdapterModule } from '../adapters/adapter.module';
import { CustomerModule } from '../customer/customer.module';
import { ErpModule } from '../erp/erp.module';
import { EventModule } from '../event/event.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { MarketplaceConnectionModule } from '../marketplace-connection/marketplace-connection.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReturnModule } from '../return/return.module';
import { StockModule } from '../stock/stock.module';
import { OutboundWebhookModule } from '../webhook/outbound-webhook.module';

import { OrderController } from './order.controller';
import { OrderPullService } from './order-pull.service';
import { OrderService } from './order.service';
import { ShippingLabelService } from './shipping-label.service';

@Module({
  imports: [
    PrismaModule,
    StockModule,
    OutboundWebhookModule,
    InvoiceModule,
    AccountingModule,
    ReturnModule,
    ErpModule,
    AdapterModule,
    MarketplaceConnectionModule,
    CustomerModule,
    EventModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderPullService, ShippingLabelService],
  exports: [OrderService, OrderPullService],
})
export class OrderModule {}
