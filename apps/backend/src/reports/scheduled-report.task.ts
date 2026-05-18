import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CustomReportService } from './custom-report.service';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function shouldRunScheduledReport(
  schedule: unknown,
  serverLocalDay: number,
): boolean {
  if (!isRecord(schedule)) {
    return false;
  }
  if (typeof schedule.cron !== 'string' || !schedule.cron.trim()) {
    return false;
  }
  const emails = schedule.emails;
  if (!Array.isArray(emails) || emails.filter((e) => typeof e === 'string').length === 0) {
    return false;
  }
  const frequency = schedule.frequency === 'weekly' ? 'weekly' : 'daily';
  if (frequency === 'weekly') {
    return serverLocalDay === 1;
  }
  return true;
}

@Injectable()
export class ScheduledReportTask {
  private readonly logger = new Logger(ScheduledReportTask.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly customReportService: CustomReportService,
  ) {}

  @Cron('0 0 * * *')
  async dispatchScheduledReports(): Promise<void> {
    const day = new Date().getDay();
    const rows = await this.prisma.savedReport.findMany({
      where: { NOT: { schedule: { equals: Prisma.DbNull } } },
      select: { id: true, schedule: true, organizationId: true },
    });
    this.logger.log('Zamanlanmış rapor kontrolü', { aday: rows.length });
    for (const r of rows) {
      if (!shouldRunScheduledReport(r.schedule, day)) {
        continue;
      }
      try {
        await this.customReportService.runScheduledReport(r.id);
      } catch (error) {
        this.logger.error('Zamanlanmış rapor çalıştırılamadı', {
          reportId: r.id,
          organizationId: r.organizationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
