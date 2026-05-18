import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AdapterModule } from './adapters/adapter.module';
import { ApiKeyModule } from './api-key/api-key.module';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './common/cache/cache.module';
import { CargoModule } from './cargo/cargo.module';
import { CommonModule } from './common/common.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { EventModule } from './event/event.module';
import { ErpConnectionModule } from './erp-connection/erp-connection.module';
import { HealthModule } from './health/health.module';
import { ImageModule } from './image/image.module';
import { ImpersonationModule } from './impersonation/impersonation.module';
import { JobsModule } from './jobs/jobs.module';
import { ListingModule } from './listing/listing.module';
import { MigrationModule } from './migration/migration.module';
import { MarketplaceConnectionModule } from './marketplace-connection/marketplace-connection.module';
import { NotificationModule } from './notification/notification.module';
import { InAppNotificationModule } from './notifications/in-app/in-app-notification.module';
import { EmailModule } from './notifications/email/email.module';
import { PushModule } from './notifications/push/push.module';
import { SmsModule } from './notifications/sms/sms.module';
import { OrderModule } from './order/order.module';
import { OrganizationModule } from './organization/organization.module';
import { PartnerModule } from './partner/partner.module';
import { PrismaModule } from './prisma/prisma.module';
import { PricingModule } from './pricing/pricing.module';
import { ProductModule } from './product/product.module';
import { QueueModule } from './queue/queue.module';
import { ReportsModule } from './reports/reports.module';
import { StockModule } from './stock/stock.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { SyncStatusModule } from './sync-status/sync-status.module';
import { UsersModule } from './users/users.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 100 },
      { name: 'long', ttl: 3_600_000, limit: 1000 },
    ]),
    PrismaModule,
    EmailModule,
    SmsModule,
    PushModule,
    CommonModule,
    CacheModule,
    CargoModule,
    AdapterModule,
    MarketplaceConnectionModule,
    ErpConnectionModule,
    JobsModule,
    QueueModule,
    EventModule,
    AuthModule,
    AdminModule,
    ApiKeyModule,
    OrganizationModule,
    OrderModule,
    ListingModule,
    MigrationModule,
    ImageModule,
    ProductModule,
    PricingModule,
    StockModule,
    WarehouseModule,
    UsersModule,
    HealthModule,
    SyncStatusModule,
    NotificationModule,
    InAppNotificationModule,
    SubscriptionModule,
    PartnerModule,
    ImpersonationModule,
    WebhookModule,
    ReportsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule {}
