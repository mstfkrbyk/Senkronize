import { Module } from '@nestjs/common';

import { ApiKeyModule } from '../api-key/api-key.module';
import { PricingModule } from '../pricing/pricing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StockModule } from '../stock/stock.module';

import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';

@Module({
  imports: [ApiKeyModule, PrismaModule, StockModule, PricingModule],
  controllers: [ListingController],
  providers: [ListingService],
  exports: [ListingService],
})
export class ListingModule {}
