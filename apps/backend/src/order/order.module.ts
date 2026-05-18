import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { StockModule } from '../stock/stock.module';

import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [PrismaModule, StockModule],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
