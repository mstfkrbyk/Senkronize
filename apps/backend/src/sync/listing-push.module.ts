import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { QUEUE_LISTING_SYNC } from '../queue/queue.constants';

import { ListingPushService } from './listing-push.service';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: QUEUE_LISTING_SYNC }),
  ],
  providers: [ListingPushService],
  exports: [ListingPushService],
})
export class ListingPushModule {}
