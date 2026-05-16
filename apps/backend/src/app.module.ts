import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdapterModule } from './adapters/adapter.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { EventModule } from './event/event.module';
import { ErpConnectionModule } from './erp-connection/erp-connection.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { ListingModule } from './listing/listing.module';
import { MarketplaceConnectionModule } from './marketplace-connection/marketplace-connection.module';
import { NotificationModule } from './notification/notification.module';
import { OrderModule } from './order/order.module';
import { OrganizationModule } from './organization/organization.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { StockModule } from './stock/stock.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { SyncStatusModule } from './sync-status/sync-status.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    CommonModule,
    AdapterModule,
    MarketplaceConnectionModule,
    ErpConnectionModule,
    JobsModule,
    QueueModule,
    EventModule,
    AuthModule,
    OrganizationModule,
    OrderModule,
    ListingModule,
    StockModule,
    UsersModule,
    HealthModule,
    SyncStatusModule,
    NotificationModule,
    SubscriptionModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
