import { Module } from '@nestjs/common';

import { ReportsModule } from '../reports/reports.module';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsExportService } from './analytics-export.service';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [ReportsModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService, AnalyticsExportService],
  exports: [AnalyticsService, AnalyticsExportService],
})
export class AnalyticsModule {}
