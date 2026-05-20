import { Module } from '@nestjs/common';

import { CurrencyCoreModule } from '../currency/currency-core.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CustomReportService } from './custom-report.service';
import { ReportPdfService } from './report-pdf.service';
import { ReportScheduleService } from './report-schedule.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ScheduledReportTask } from './scheduled-report.task';
import { TaxReportService } from './tax-report.service';
import { WeeklyReportTask } from './weekly-report.task';

@Module({
  imports: [PrismaModule, NotificationModule, CurrencyCoreModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    CustomReportService,
    ScheduledReportTask,
    TaxReportService,
    ReportPdfService,
    ReportScheduleService,
    WeeklyReportTask,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
