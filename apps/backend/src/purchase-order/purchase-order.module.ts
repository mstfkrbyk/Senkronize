import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { StockModule } from '../stock/stock.module';

import { PurchaseOrderController } from './purchase-order.controller';
import { PurchaseOrderService } from './purchase-order.service';

@Module({
  imports: [PrismaModule, StockModule],
  controllers: [PurchaseOrderController],
  providers: [PurchaseOrderService],
  exports: [PurchaseOrderService],
})
export class PurchaseOrderModule {}
