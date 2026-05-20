import { Module } from '@nestjs/common';

import { AdaptersCommonModule } from '../adapters/common/adapters-common.module';
import { ErpConnectionModule } from '../erp-connection/erp-connection.module';
import { ErpModule } from '../erp/erp.module';
import { CustomerModule } from '../customer/customer.module';
import { ImageModule } from '../image/image.module';
import { ImageSyncProcessor } from '../image/image-sync.processor';
import { ImageProcessor } from '../image/image.processor';
import { ListingModule } from '../listing/listing.module';
import { MarketplaceConnectionModule } from '../marketplace-connection/marketplace-connection.module';
import { OrderModule } from '../order/order.module';
import { PricingModule } from '../pricing/pricing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductModule } from '../product/product.module';
import { ReturnModule } from '../return/return.module';
import { StockModule } from '../stock/stock.module';
import { SyncStatusModule } from '../sync-status/sync-status.module';
import { SyncModule } from '../sync/sync.module';

import { BuyBoxFetchTask } from './buybox-fetch.task';
import { ListingSyncProcessor } from './listing-sync.processor';
import { CompetitorPriceTask } from '../pricing/competitor-price.task';
import {
  MarketplaceJobFailureHandler,
  MarketplacePullDlqHooks,
  MarketplacePushDlqHooks,
  DeadLetterProcessor,
  DeadLetterService,
  ListingSyncDlqHooks,
} from './dlq.processor';
import { ErpSyncProcessor } from './erp-sync.processor';
import { ErpSyncTask } from './erp-sync.task';
import { MarketplacePullProcessor } from './marketplace-pull.processor';
import { MarketplacePushProcessor } from './marketplace-push.processor';
import { PricingProcessor } from './pricing.processor';
import { StockAlertTask } from './stock-alert.task';
import { SyncSchedulerTask } from './sync-scheduler.task';
import { InAppNotificationModule } from '../notifications/in-app/in-app-notification.module';
import { DashboardModule } from '../dashboard/dashboard.module';
import { MigrationModule } from '../migration/migration.module';

import { DataImportProcessor } from './data-import.processor';

@Module({
  imports: [
    AdaptersCommonModule,
    PrismaModule,
    SyncModule,
    SyncStatusModule,
    MarketplaceConnectionModule,
    OrderModule,
    CustomerModule,
    ErpConnectionModule,
    ErpModule,
    ListingModule,
    PricingModule,
    ImageModule,
    ProductModule,
    InAppNotificationModule,
    StockModule,
    ReturnModule,
    DashboardModule,
    MigrationModule,
  ],
  providers: [
    MarketplaceJobFailureHandler,
    DeadLetterService,
    MarketplacePullDlqHooks,
    MarketplacePushDlqHooks,
    ListingSyncDlqHooks,
    DeadLetterProcessor,
    MarketplacePullProcessor,
    MarketplacePushProcessor,
    ListingSyncProcessor,
    ErpSyncProcessor,
    ErpSyncTask,
    PricingProcessor,
    ImageProcessor,
    ImageSyncProcessor,
    BuyBoxFetchTask,
    CompetitorPriceTask,
    SyncSchedulerTask,
    StockAlertTask,
    DataImportProcessor,
  ],
})
export class JobsModule {}
