import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  ReportScheduleFrequency,
  StandardReportKind,
} from '@prisma/client';

import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';

import { parseReportPeriod, ReportPdfService } from './report-pdf.service';
import type { CreateReportScheduleDto } from './reports.dto';

export interface ReportScheduleItem {
  id: string;
  organizationId: string;
  reportKind: StandardReportKind;
  frequency: ReportScheduleFrequency;
  emails: string[];
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function parseEmailsJson(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((e): e is string => typeof e === 'string' && e.trim().length > 0);
}

function reportKindLabel(kind: StandardReportKind): string {
  switch (kind) {
    case StandardReportKind.SALES:
      return 'Satış';
    case StandardReportKind.STOCK:
      return 'Stok';
    case StandardReportKind.PROFIT:
      return 'Kâr';
    default:
      return kind;
  }
}

@Injectable()
export class ReportScheduleService {
  private readonly logger = new Logger(ReportScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportPdfService: ReportPdfService,
    private readonly notificationService: NotificationService,
  ) {}

  async saveSchedule(
    organizationId: string,
    userId: string,
    dto: CreateReportScheduleDto,
  ): Promise<ReportScheduleItem> {
    const emails = [...new Set(dto.emails.map((e) => e.trim().toLowerCase()))].filter(
      Boolean,
    );
    const existing = await this.prisma.reportSchedule.findFirst({
      where: { organizationId, reportKind: dto.reportKind },
    });
    const row = existing
      ? await this.prisma.reportSchedule.update({
          where: { id: existing.id },
          data: {
            frequency: dto.frequency,
            emails: emails as unknown as Prisma.InputJsonValue,
            deletedAt: null,
          },
        })
      : await this.prisma.reportSchedule.create({
          data: {
            organizationId,
            reportKind: dto.reportKind,
            frequency: dto.frequency,
            emails: emails as unknown as Prisma.InputJsonValue,
            createdBy: userId,
          },
        });
    return this.toItem(row);
  }

  async dispatchDueSchedules(serverDay: number, dayOfMonth: number): Promise<void> {
    const rows = await this.prisma.reportSchedule.findMany({
      where: { deletedAt: null },
    });
    for (const row of rows) {
      const shouldRun =
        row.frequency === ReportScheduleFrequency.WEEKLY
          ? serverDay === 1
          : dayOfMonth === 1;
      if (!shouldRun) {
        continue;
      }
      const emails = parseEmailsJson(row.emails);
      if (emails.length === 0) {
        continue;
      }
      try {
        await this.sendScheduledPdf(row.organizationId, row.reportKind, emails);
        await this.prisma.reportSchedule.update({
          where: { id: row.id },
          data: { lastRunAt: new Date() },
        });
      } catch (error) {
        this.logger.error('Zamanlanmış standart rapor gönderilemedi', {
          scheduleId: row.id,
          organizationId: row.organizationId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async sendScheduledPdf(
    organizationId: string,
    reportKind: StandardReportKind,
    emails: string[],
  ): Promise<void> {
    const period = '30d' as const;
    let buffer: Buffer;
    let filename: string;
    switch (reportKind) {
      case StandardReportKind.SALES:
        buffer = await this.reportPdfService.generateSalesReport(organizationId, period);
        filename = 'satis-raporu.pdf';
        break;
      case StandardReportKind.STOCK:
        buffer = await this.reportPdfService.generateStockReport(organizationId);
        filename = 'stok-raporu.pdf';
        break;
      case StandardReportKind.PROFIT:
        buffer = await this.reportPdfService.generateProfitReport(organizationId, period);
        filename = 'kar-raporu.pdf';
        break;
      default:
        return;
    }
    const label = reportKindLabel(reportKind);
    const range = parseReportPeriod(period);
    const subject = `Senkronize ${label} raporu — ${range.label}`;
    const html = `<p>Merhaba,</p><p>Zamanlanmış <strong>${label}</strong> raporunuz ektedir.</p><p>Senkronize</p>`;
    for (const to of emails) {
      await this.notificationService.sendEmail({
        to,
        subject,
        html,
        attachments: [
          {
            filename,
            contentBase64: buffer.toString('base64'),
          },
        ],
      });
    }
    this.logger.log('Zamanlanmış standart rapor gönderildi', {
      organizationId,
      reportKind,
      recipientCount: emails.length,
    });
  }

  private toItem(row: {
    id: string;
    organizationId: string;
    reportKind: StandardReportKind;
    frequency: ReportScheduleFrequency;
    emails: Prisma.JsonValue;
    lastRunAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ReportScheduleItem {
    return {
      id: row.id,
      organizationId: row.organizationId,
      reportKind: row.reportKind,
      frequency: row.frequency,
      emails: parseEmailsJson(row.emails),
      lastRunAt: row.lastRunAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
