import { Module } from '@nestjs/common';

import { ErpConnectionModule } from '../erp-connection/erp-connection.module';
import { ImageModule } from '../image/image.module';
import { ImageSyncProcessor } from '../image/image-sync.processor';
import { ImageProcessor } from '../image/image.processor';
import { ListingModule } from '../listing/listing.module';
import { MarketplaceConnectionModule } from '../marketplace-connection/marketplace-connection.module';
import { OrderModule } from '../order/order.module';
import { PricingModule } from '../pricing/pricing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductModule } from '../product/product.module';
import { SyncStatusModule } from '../sync-status/sync-status.module';

import { BuyBoxFetchTask } from './buybox-fetch.task';
import {
  MarketplaceJobFailureHandler,
  MarketplacePullDlqHooks,
  MarketplacePushDlqHooks,
} from './dlq.processor';
import { ErpSyncProcessor } from './erp-sync.processor';
import { MarketplacePullProcessor } from './marketplace-pull.processor';
import { MarketplacePushProcessor } from './marketplace-push.processor';
import { PricingProcessor } from './pricing.processor';
import { StockAlertTask } from './stock-alert.task';
import { SyncSchedulerTask } from './sync-scheduler.task';

@Module({
  imports: [
    PrismaModule,
    SyncStatusModule,
    MarketplaceConnectionModule,
    OrderModule,
    ErpConnectionModule,
    ListingModule,
    PricingModule,
    ImageModule,
    ProductModule,
  ],
  providers: [
    MarketplaceJobFailureHandler,
    MarketplacePullDlqHooks,
    MarketplacePushDlqHooks,
    MarketplacePullProcessor,
    MarketplacePushProcessor,
    ErpSyncProcessor,
    PricingProcessor,
    ImageProcessor,
    ImageSyncProcessor,
    BuyBoxFetchTask,
    SyncSchedulerTask,
    StockAlertTask,
  ],
})
export class JobsModule {}
