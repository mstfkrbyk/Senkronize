import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { IntegrationPolicyModule } from '../integration-policy/integration-policy.module';
import { AdminController } from './admin.controller';
import { SuperAdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AdminStatsService } from './admin-stats.service';

import { PartnerModule } from '../partner/partner.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    AuthModule,
    AuditModule,
    PrismaModule,
    IntegrationPolicyModule,
    UsersModule,
    PartnerModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '15m') as NonNullable<JwtSignOptions['expiresIn']>,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminController],
  providers: [SuperAdminGuard, AdminService, AdminStatsService],
  exports: [SuperAdminGuard],
})
export class AdminModule {}
