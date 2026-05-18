import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StockModule } from '../stock/stock.module';

import { ReturnController } from './return.controller';
import { ReturnService } from './return.service';

@Module({
  imports: [PrismaModule, StockModule],
  controllers: [ReturnController],
  providers: [ReturnService],
  exports: [ReturnService],
})
export class ReturnModule {}
