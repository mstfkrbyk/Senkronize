import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditContextInterceptor } from './audit/audit-context.interceptor';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AdapterModule } from './adapters/adapter.module';
import { ApiKeyModule } from './api-key/api-key.module';
import { AuthModule } from './auth/auth.module';
import { CacheModule } from './common/cache/cache.module';
import { CommonModule } from './common/common.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { DemoModeGuard } from './common/guards/demo-mode.guard';
import { IpBlockGuard } from './common/guards/ip-block.guard';
import { CampaignModule } from './campaign/campaign.module';
import { CategoryModule } from './category/category.module';
import { CargoModule } from './cargo/cargo.module';
import { LoggerMiddleware } from './common/middleware/logger.middleware';
import { CurrencyModule } from './currency/currency.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EventModule } from './event/event.module';
import { ErpConnectionModule } from './erp-connection/erp-connection.module';
import { HealthModule } from './health/health.module';
import { ImageModule } from './image/image.module';
import { InvoiceModule } from './invoice/invoice.module';
import { ImpersonationModule } from './impersonation/impersonation.module';
import { JobsModule } from './jobs/jobs.module';
import { ListingModule } from './listing/listing.module';
import { MigrationModule } from './migration/migration.module';
import { MarketplaceConnectionModule } from './marketplace-connection/marketplace-connection.module';
import { NotificationModule } from './notification/notification.module';
import { InAppNotificationModule } from './notifications/in-app/in-app-notification.module';
import { EmailModule } from './notifications/email/email.module';
import { NotificationsModule } from './notifications/notification.module';
import { PushModule } from './notifications/push/push.module';
import { SmsModule } from './notifications/sms/sms.module';
import { OrderModule } from './order/order.module';
import { OrganizationModule } from './organization/organization.module';
import { PartnerModule } from './partner/partner.module';
import { PrismaModule } from './prisma/prisma.module';
import { PricingModule } from './pricing/pricing.module';
import { ProductMatchModule } from './product-match/product-match.module';
import { ProductModule } from './product/product.module';
import { PurchaseOrderModule } from './purchase-order/purchase-order.module';
import { QueueModule } from './queue/queue.module';
import { ReportsModule } from './reports/reports.module';
import { SecurityModule } from './security/security.module';
import { SecurityRequestInterceptor } from './security/security-request.interceptor';
import { ReturnModule } from './return/return.module';
import { SearchModule } from './search/search.module';
import { SupportModule } from './support/support.module';
import { StockModule } from './stock/stock.module';
import { SupplierModule } from './supplier/supplier.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { SyncStatusModule } from './sync-status/sync-status.module';
import { SyncModule } from './sync/sync.module';
import { UsersModule } from './users/users.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 100 },
      { name: 'long', ttl: 3_600_000, limit: 1000 },
    ]),
    PrismaModule,
    AuditModule,
    SecurityModule,
    EmailModule,
    SmsModule,
    PushModule,
    NotificationsModule,
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
    InvoiceModule,
    ListingModule,
    MigrationModule,
    ImageModule,
    ProductModule,
    ProductMatchModule,
    CategoryModule,
    PurchaseOrderModule,
    PricingModule,
    CampaignModule,
    StockModule,
    SupplierModule,
    WarehouseModule,
    UsersModule,
    HealthModule,
    SyncStatusModule,
    SyncModule,
    NotificationModule,
    InAppNotificationModule,
    SubscriptionModule,
    PartnerModule,
    ImpersonationModule,
    WebhookModule,
    ReportsModule,
    AnalyticsModule,
    DashboardModule,
    ReturnModule,
    SearchModule,
    CurrencyModule,
    SupportModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: IpBlockGuard },
    { provide: APP_GUARD, useClass: DemoModeGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditContextInterceptor },
    { provide: APP_INTERCEPTOR, useClass: SecurityRequestInterceptor },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(LoggerMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'api/v1/health', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
