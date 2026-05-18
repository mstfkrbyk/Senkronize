import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { WarehouseModule } from '../warehouse/warehouse.module';

import { StockController } from './stock.controller';
import { StockMovementService } from './stock-movement.service';
import { StockService } from './stock.service';

@Module({
  imports: [PrismaModule, WarehouseModule],
  controllers: [StockController],
  providers: [StockService, StockMovementService],
  exports: [StockService, StockMovementService, WarehouseModule],
})
export class StockModule {}
