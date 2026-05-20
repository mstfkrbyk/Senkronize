import { InjectQueue, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import {
  AnomalySeverity,
  AnomalyType,
  NotificationType,
  UserRole,
} from '@prisma/client';
import type { Job, Queue } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email/email.service';
import { InAppNotificationService } from '../notifications/in-app/in-app-notification.service';
import {
  DLQ_JOB_OPTIONS,
  LISTING_SYNC_JOB_OPTIONS,
  QUEUE_DEAD_LETTER,
  QUEUE_LISTING_SYNC,
  QUEUE_MARKETPLACE_PULL,
  QUEUE_MARKETPLACE_PUSH,
} from '../queue/queue.constants';
import type {
  DeadLetterJobData,
  ListingSyncBatchJobData,
} from '../queue/queue.types';

function normalizeJobError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }
  return new Error(typeof err === 'string' ? err : 'Bilinmeyen hata');
}

function extractOrganizationId(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  if (typeof record.organizationId === 'string') {
    return record.organizationId;
  }
  if (typeof record.orgId === 'string') {
    return record.orgId;
  }
  return undefined;
}

function jobReplayMetadata(job: Job): Record<string, unknown> {
  const d = job.data;
  if (typeof d !== 'object' || d === null) {
    return {};
  }
  const data = d as Record<string, unknown>;
  const meta: Record<string, unknown> = {};
  if (typeof data.platform === 'string') {
    meta.platform = data.platform;
  }
  if (typeof data.type === 'string') {
    meta.jobDataType = data.type;
  }
  if (typeof data.since === 'string') {
    meta.since = data.since;
  }
  if (Array.isArray(data.resourceIds)) {
    meta.resourceIds = data.resourceIds.filter(
      (x): x is string => typeof x === 'string',
    );
  }
  if (data.payload !== undefined && data.payload !== null) {
    meta.payload = data.payload;
  }
  return meta;
}

function isListingSyncBatchPayload(
  payload: unknown,
): payload is ListingSyncBatchJobData {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const record = payload as Record<string, unknown>;
  return (
    typeof record.orgId === 'string' &&
    typeof record.platform === 'string' &&
    Array.isArray(record.updates)
  );
}

@Injectable()
export class MarketplaceJobFailureHandler {
  private readonly logger = new Logger(MarketplaceJobFailureHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly inAppNotificationService: InAppNotificationService,
  ) {}

  async handle(queueLabel: string, job: Job, err: unknown): Promise<void> {
    const error = normalizeJobError(err);
    this.logger.error(
      `Kuyruk işi başarısız: ${job.name} | ${error.message}`,
      { queue: queueLabel, jobId: String(job.id) },
    );

    const organizationId = extractOrganizationId(job.data);
    const superAdmin = await this.prisma.user.findFirst({
      where: { role: UserRole.SUPER_ADMIN, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    const actorUserId = superAdmin?.id ?? 'system';
    const actorOrgId =
      organizationId ?? superAdmin?.organizationId ?? 'system';

    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        actorOrgId,
        impersonatedOrgId: null,
        action: 'queue.job_failed',
        resourceType: 'BullJob',
        resourceId: job.id != null ? String(job.id) : null,
        metadata: {
          queue: queueLabel,
          jobName: job.name,
          organizationId: organizationId ?? null,
          attemptsMade: job.attemptsMade,
          maxAttempts: job.opts.attempts ?? null,
          failedReason: error.message.slice(0, 2000),
          ...jobReplayMetadata(job),
        },
      },
    });

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    if (organizationId) {
      try {
        await this.inAppNotificationService.create({
          organizationId,
          type: NotificationType.SYNC_ERROR,
          title: 'Senkronizasyon hatası',
          message: `${queueLabel} — ${job.name}: ${error.message.slice(0, 400)}`,
          link: '/sync-logs',
          metadata: {
            jobId: job.id != null ? String(job.id) : null,
            queue: queueLabel,
            jobName: job.name,
          },
        });
      } catch (notifyErr) {
        this.logger.warn('In-app sync hata bildirimi oluşturulamadı', {
          organizationId,
          message:
            notifyErr instanceof Error ? notifyErr.message : 'unknown',
        });
      }
    }

    const alertTo = this.configService.get<string>('OPS_ALERT_EMAIL')?.trim();
    if (!alertTo) {
      return;
    }

    await this.emailService.sendJobFailureAlert(alertTo, {
      queueLabel,
      jobName: job.name,
      organizationId,
      errorMessage: error.message,
      jobId: job.id != null ? String(job.id) : undefined,
    });
  }
}

@Injectable()
export class DeadLetterService {
  private readonly logger = new Logger(DeadLetterService.name);

  constructor(
    @InjectQueue(QUEUE_DEAD_LETTER)
    private readonly dlqQueue: Queue<DeadLetterJobData>,
    @InjectQueue(QUEUE_LISTING_SYNC)
    private readonly listingSyncQueue: Queue<ListingSyncBatchJobData>,
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly inAppNotificationService: InAppNotificationService,
  ) {}

  async moveToDeadLetter(
    sourceQueue: string,
    job: Job,
    err: unknown,
  ): Promise<void> {
    const error = normalizeJobError(err);
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    const organizationId = extractOrganizationId(job.data);
    const dlqData: DeadLetterJobData = {
      sourceQueue,
      jobName: job.name,
      payload: job.data,
      errorMessage: error.message.slice(0, 2000),
      attemptsMade: job.attemptsMade,
      organizationId,
      failedAt: new Date().toISOString(),
      dlqReplayCount: 0,
    };

    await this.dlqQueue.add('store', dlqData, DLQ_JOB_OPTIONS);
    this.logger.warn('İş dead-letter kuyruğuna alındı', {
      sourceQueue,
      jobName: job.name,
      jobId: String(job.id),
    });
  }

  /** Her gece 02:00 — DLQ'daki işleri yeniden dene */
  @Cron('0 2 * * *')
  async scheduleDeadLetterRetry(): Promise<void> {
    const waiting = await this.dlqQueue.getJobs(['waiting', 'delayed']);
    if (waiting.length === 0) {
      return;
    }

    this.logger.log(`DLQ gece yeniden deneme: ${String(waiting.length)} iş`);
    for (const job of waiting) {
      await this.dlqQueue.add('replay', job.data, DLQ_JOB_OPTIONS);
      await job.remove();
    }
  }

  async replayDeadLetterJob(data: DeadLetterJobData): Promise<void> {
    const replayCount = data.dlqReplayCount + 1;

    try {
      if (
        data.sourceQueue === QUEUE_LISTING_SYNC &&
        isListingSyncBatchPayload(data.payload)
      ) {
        await this.listingSyncQueue.add(
          'sync-batch',
          {
            ...data.payload,
            dlqReplay: true,
            dlqReplayCount: replayCount,
          },
          { ...LISTING_SYNC_JOB_OPTIONS, attempts: 1 },
        );
        return;
      }

      if (data.sourceQueue === QUEUE_LISTING_SYNC) {
        await this.listingSyncQueue.add(
          data.jobName,
          data.payload as ListingSyncBatchJobData,
          { ...LISTING_SYNC_JOB_OPTIONS, attempts: 1 },
        );
        return;
      }

      throw new Error(`DLQ replay desteklenmeyen kuyruk: ${data.sourceQueue}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'DLQ replay başarısız';
      await this.handlePermanentFailure(data, message, replayCount);
      throw error;
    }
  }

  async handlePermanentFailure(
    data: DeadLetterJobData,
    errorMessage: string,
    replayCount: number,
  ): Promise<void> {
    const organizationId =
      data.organizationId ?? extractOrganizationId(data.payload) ?? 'system';

    try {
      await this.prisma.anomalyLog.create({
        data: {
          organizationId,
          type: AnomalyType.API_RATE_SPIKE,
          severity: AnomalySeverity.HIGH,
          details: {
            kind: 'queue_dlq_permanent_failure',
            sourceQueue: data.sourceQueue,
            jobName: data.jobName,
            errorMessage: errorMessage.slice(0, 2000),
            dlqReplayCount: replayCount,
            failedAt: data.failedAt,
          },
        },
      });
    } catch (anomalyErr) {
      this.logger.warn('AnomalyLog yazılamadı', {
        message:
          anomalyErr instanceof Error ? anomalyErr.message : 'unknown',
      });
    }

    if (organizationId !== 'system') {
      try {
        await this.inAppNotificationService.create({
          organizationId,
          type: NotificationType.SYNC_ERROR,
          title: 'Senkronizasyon kalıcı hata',
          message: `${data.sourceQueue} — ${data.jobName}: ${errorMessage.slice(0, 400)}`,
          link: '/sync-logs',
          metadata: {
            sourceQueue: data.sourceQueue,
            jobName: data.jobName,
            dlqReplayCount: replayCount,
          },
        });
      } catch {
        // bildirim opsiyonel
      }
    }

    const alertTo = this.configService.get<string>('OPS_ALERT_EMAIL')?.trim();
    if (alertTo) {
      await this.emailService.sendJobFailureAlert(alertTo, {
        queueLabel: `${data.sourceQueue}/dlq`,
        jobName: data.jobName,
        organizationId: organizationId === 'system' ? undefined : organizationId,
        errorMessage,
      });
    }
  }
}

@Injectable()
@Processor(QUEUE_MARKETPLACE_PULL)
export class MarketplacePullDlqHooks {
  constructor(private readonly failureHandler: MarketplaceJobFailureHandler) {}

  @OnQueueFailed()
  async onFailed(job: Job, err: unknown): Promise<void> {
    await this.failureHandler.handle(QUEUE_MARKETPLACE_PULL, job, err);
  }
}

@Injectable()
@Processor(QUEUE_MARKETPLACE_PUSH)
export class MarketplacePushDlqHooks {
  constructor(private readonly failureHandler: MarketplaceJobFailureHandler) {}

  @OnQueueFailed()
  async onFailed(job: Job, err: unknown): Promise<void> {
    await this.failureHandler.handle(QUEUE_MARKETPLACE_PUSH, job, err);
  }
}

@Injectable()
@Processor(QUEUE_LISTING_SYNC)
export class ListingSyncDlqHooks {
  constructor(
    private readonly failureHandler: MarketplaceJobFailureHandler,
    private readonly deadLetterService: DeadLetterService,
  ) {}

  @OnQueueFailed()
  async onFailed(job: Job, err: unknown): Promise<void> {
    await this.failureHandler.handle(QUEUE_LISTING_SYNC, job, err);
    await this.deadLetterService.moveToDeadLetter(
      QUEUE_LISTING_SYNC,
      job,
      err,
    );

    const data = job.data as ListingSyncBatchJobData | undefined;
    if (
      data?.dlqReplay &&
      (data.dlqReplayCount ?? 0) >= 1 &&
      job.attemptsMade >= (job.opts.attempts ?? 1)
    ) {
      await this.deadLetterService.handlePermanentFailure(
        {
          sourceQueue: QUEUE_LISTING_SYNC,
          jobName: job.name,
          payload: job.data,
          errorMessage:
            err instanceof Error ? err.message : 'DLQ yeniden deneme başarısız',
          attemptsMade: job.attemptsMade,
          organizationId: extractOrganizationId(job.data),
          failedAt: new Date().toISOString(),
          dlqReplayCount: data.dlqReplayCount ?? 1,
        },
        err instanceof Error ? err.message : 'DLQ yeniden deneme başarısız',
        data.dlqReplayCount ?? 1,
      );
    }
  }
}

@Injectable()
@Processor(QUEUE_DEAD_LETTER)
export class DeadLetterProcessor {
  private readonly logger = new Logger(DeadLetterProcessor.name);

  constructor(private readonly deadLetterService: DeadLetterService) {}

  @Process('store')
  async store(job: Job<DeadLetterJobData>): Promise<void> {
    this.logger.log('DLQ kaydı alındı', {
      sourceQueue: job.data.sourceQueue,
      jobName: job.data.jobName,
    });
  }

  @Process('replay')
  async replay(job: Job<DeadLetterJobData>): Promise<void> {
    try {
      await this.deadLetterService.replayDeadLetterJob(job.data);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'DLQ replay başarısız';
      this.logger.error('DLQ replay başarısız', {
        sourceQueue: job.data.sourceQueue,
        jobName: job.data.jobName,
        error: message,
      });
      await this.deadLetterService.handlePermanentFailure(
        job.data,
        message,
        job.data.dlqReplayCount + 1,
      );
      throw error;
    }
  }
}
