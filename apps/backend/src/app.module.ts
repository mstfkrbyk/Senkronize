import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { EventModule } from './event/event.module';
import { HealthModule } from './health/health.module';
import { NotificationModule } from './notification/notification.module';
import { OrganizationModule } from './organization/organization.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { SyncStatusModule } from './sync-status/sync-status.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    CommonModule,
    QueueModule,
    EventModule,
    AuthModule,
    OrganizationModule,
    UsersModule,
    HealthModule,
    SyncStatusModule,
    NotificationModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
