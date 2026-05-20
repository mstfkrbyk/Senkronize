import { Module } from '@nestjs/common';

import { PricingModule } from '../pricing/pricing.module';
import { ReportsModule } from '../reports/reports.module';
import { UsersModule } from '../users/users.module';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ReportsModule, PricingModule, UsersModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
