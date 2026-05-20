import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';

import { PrismaModule } from '../prisma/prisma.module';
import { QUEUE_LISTING_SYNC } from '../queue/queue.constants';
import { StockModule } from '../stock/stock.module';
import { SupplierModule } from '../supplier/supplier.module';

import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrderPdfService } from './purchase-order-pdf.service';
import { PurchaseOrderService } from './purchase-order.service';

@Module({
  imports: [
    PrismaModule,
    StockModule,
    SupplierModule,
    BullModule.registerQueue({ name: QUEUE_LISTING_SYNC }),
  ],
  controllers: [PurchaseOrderController],
  providers: [PurchaseOrderService, PurchaseOrderPdfService],
  exports: [PurchaseOrderService],
})
export class PurchaseOrderModule {}
