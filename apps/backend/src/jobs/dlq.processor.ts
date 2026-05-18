import { OnQueueFailed, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import type { Job } from 'bull';

import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../notifications/email/email.service';
import {
  QUEUE_MARKETPLACE_PULL,
  QUEUE_MARKETPLACE_PUSH,
} from '../queue/queue.constants';

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
  const orgId = (data as { organizationId?: unknown }).organizationId;
  return typeof orgId === 'string' ? orgId : undefined;
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

@Injectable()
export class MarketplaceJobFailureHandler {
  private readonly logger = new Logger(MarketplaceJobFailureHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
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
