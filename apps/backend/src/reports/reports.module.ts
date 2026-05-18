import { Module } from '@nestjs/common';

import { CurrencyCoreModule } from '../currency/currency-core.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CustomReportService } from './custom-report.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ScheduledReportTask } from './scheduled-report.task';
import { TaxReportService } from './tax-report.service';

@Module({
  imports: [PrismaModule, NotificationModule, CurrencyCoreModule],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    CustomReportService,
    ScheduledReportTask,
    TaxReportService,
  ],
})
export class ReportsModule {}
