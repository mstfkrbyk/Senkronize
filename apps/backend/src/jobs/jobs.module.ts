import { Module } from '@nestjs/common';

import { ErpConnectionModule } from '../erp-connection/erp-connection.module';
import { ImageModule } from '../image/image.module';
import { ImageProcessor } from '../image/image.processor';
import { ListingModule } from '../listing/listing.module';
import { MarketplaceConnectionModule } from '../marketplace-connection/marketplace-connection.module';
import { OrderModule } from '../order/order.module';
import { PricingModule } from '../pricing/pricing.module';
import { ProductModule } from '../product/product.module';
import { SyncStatusModule } from '../sync-status/sync-status.module';

import { BuyBoxFetchTask } from './buybox-fetch.task';
import { ErpSyncProcessor } from './erp-sync.processor';
import { MarketplacePullProcessor } from './marketplace-pull.processor';
import { MarketplacePushProcessor } from './marketplace-push.processor';
import { PricingProcessor } from './pricing.processor';

@Module({
  imports: [
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
    MarketplacePullProcessor,
    MarketplacePushProcessor,
    ErpSyncProcessor,
    PricingProcessor,
    ImageProcessor,
    BuyBoxFetchTask,
  ],
})
export class JobsModule {}
