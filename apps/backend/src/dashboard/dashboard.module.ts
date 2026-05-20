import { Module } from '@nestjs/common';

import { PricingModule } from '../pricing/pricing.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ReportsModule } from '../reports/reports.module';
import { UsersModule } from '../users/users.module';

import { DashboardController } from './dashboard.controller';
import { DashboardGateway } from './dashboard.gateway';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ReportsModule, PricingModule, UsersModule, PrismaModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardGateway],
  exports: [DashboardService, DashboardGateway],
})
export class DashboardModule {}
