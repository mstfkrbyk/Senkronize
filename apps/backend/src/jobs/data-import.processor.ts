import { Process, Processor } from '@nestjs/bull';
import { InjectQueue } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job, Queue } from 'bull';

import { EventService } from '../event/event.service';
import { WS_EVENTS } from '../event/event.types';
import { MigrationService } from '../migration/migration.service';
import type { MigrationSession } from '../migration/migration.types';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_DATA_IMPORT, QUEUE_NOTIFICATION } from '../queue/queue.constants';
import type { DataImportJobData, NotificationJobData } from '../queue/queue.types';

@Processor(QUEUE_DATA_IMPORT)
export class DataImportProcessor {
  private readonly logger = new Logger(DataImportProcessor.name);

  constructor(
    private readonly migrationService: MigrationService,
    private readonly eventService: EventService,
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NOTIFICATION)
    private readonly notificationQueue: Queue<NotificationJobData>,
  ) {}

  @Process('execute-import')
  async handleExecuteImport(job: Job<DataImportJobData>): Promise<void> {
    const { sessionId, organizationId } = job.data;

    try {
      await this.migrationService.processImportJob(
        sessionId,
        organizationId,
        (session) => {
          if (session.progress.processed % 100 === 0) {
            this.emitProgress(organizationId, session);
          }
        },
      );

      const finalSession = await this.migrationService.getSession(
        sessionId,
        organizationId,
      );
      this.emitProgress(organizationId, finalSession);

      await this.sendCompletionEmail(
        organizationId,
        sessionId,
        finalSession.progress,
      );
    } catch (error) {
      this.logger.error('Veri taşıma işi başarısız', {
        sessionId,
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private emitProgress(organizationId: string, session: MigrationSession): void {
    this.eventService.emit(organizationId, WS_EVENTS.MIGRATION_PROGRESS, {
      sessionId: session.id,
      processed: session.progress.processed,
      total: session.progress.total,
      imported: session.progress.imported,
      failed: session.progress.failed,
    });
  }

  private async sendCompletionEmail(
    organizationId: string,
    sessionId: string,
    progress: MigrationSession['progress'],
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!user?.email) {
      return;
    }

    await this.notificationQueue.add('send', {
      organizationId,
      userId: user.id,
      channel: 'email',
      template: 'migration_complete',
      payload: {
        sessionId,
        processed: progress.processed,
        imported: progress.imported,
        failed: progress.failed,
        message: `Veri taşıma tamamlandı. ${progress.imported} kayıt içe aktarıldı, ${progress.failed} hata.`,
      },
    });
  }
}
