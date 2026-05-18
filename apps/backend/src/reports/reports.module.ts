import { Module } from '@nestjs/common';

import { NotificationModule } from '../notification/notification.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CustomReportService } from './custom-report.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ScheduledReportTask } from './scheduled-report.task';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [ReportsController],
  providers: [ReportsService, CustomReportService, ScheduledReportTask],
})
export class ReportsModule {}
