import { Module } from '@nestjs/common';

import { ApiKeyModule } from '../api-key/api-key.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ListingController } from './listing.controller';
import { ListingService } from './listing.service';

@Module({
  imports: [ApiKeyModule, PrismaModule],
  controllers: [ListingController],
  providers: [ListingService],
  exports: [ListingService],
})
export class ListingModule {}
