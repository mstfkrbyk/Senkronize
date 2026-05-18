import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { getAuditHttpContext } from './audit-context.storage';

const SENSITIVE_PRISMA_MODELS = new Set<string>([
  'User',
  'Organization',
  'Subscription',
  'ApiKey',
  'MarketplaceConnection',
  'ErpConnection',
  'EcommerceConnection',
  'CargoConnection',
]);

const SENSITIVE_ACTIONS = new Set<string>([
  'create',
  'update',
  'upsert',
  'delete',
  'createMany',
  'updateMany',
  'deleteMany',
]);

const REDACT_KEYS = new Set(
  [
    'password',
    'passwordhash',
    'passwordHash',
    'token',
    'apikey',
    'apiKey',
    'secretkey',
    'secretKey',
    'credentialsenc',
    'credentialsEnc',
    'webhooksecret',
    'webhookSecret',
    'twofactorsecret',
    'twoFactorSecret',
    'backupcodes',
    'backupCodes',
    'refreshtoken',
    'refreshToken',
  ].map((k) => k.toLowerCase()),
);

function sanitizeForAudit(value: unknown, depth = 0): unknown {
  if (depth > 4) {
    return '[truncated]';
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((v) => sanitizeForAudit(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(k.toLowerCase())) {
        out[k] = '[redacted]';
      } else {
        out[k] = sanitizeForAudit(v, depth + 1);
      }
    }
    return out;
  }
  return String(value);
}

function extractResourceId(
  params: { args?: unknown },
  result: unknown,
): string | null {
  if (result && typeof result === 'object' && 'id' in result) {
    const id = (result as { id: unknown }).id;
    if (typeof id === 'string') {
      return id;
    }
  }
  const args = params.args as Record<string, unknown> | undefined;
  if (!args) {
    return null;
  }
  const where = args.where as Record<string, unknown> | undefined;
  if (where && typeof where.id === 'string') {
    return where.id;
  }
  return null;
}

function resolveActorFromContext(): {
  actorUserId: string;
  actorOrgId: string;
  impersonatedOrgId: string | null;
} | null {
  const ctx = getAuditHttpContext();
  if (!ctx) {
    return null;
  }
  if (ctx.kind === 'user') {
    return {
      actorUserId: ctx.actorUserId,
      actorOrgId: ctx.actorOrgId,
      impersonatedOrgId: ctx.impersonatedOrgId,
    };
  }
  return {
    actorUserId: `api-key:${ctx.apiKeyId}`,
    actorOrgId: ctx.actorOrgId,
    impersonatedOrgId: null,
  };
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Prisma `$use` middleware: kritik modellerdeki yazma işlemlerini denetim kaydına düşürür.
   * HTTP bağlamı yoksa (kuyruk, cron) kayıt atlanır.
   */
  registerPrismaMiddleware(client: PrismaClient): void {
    client.$use(async (params, next) => {
      const result = await next(params);
      if (params.model === 'AuditLog' || !params.model) {
        return result;
      }
      if (!SENSITIVE_PRISMA_MODELS.has(params.model)) {
        return result;
      }
      if (!SENSITIVE_ACTIONS.has(params.action)) {
        return result;
      }
      const actor = resolveActorFromContext();
      if (!actor) {
        return result;
      }
      const resourceId = extractResourceId(params, result);
      const metadata = {
        source: 'prisma_middleware',
        prismaModel: params.model,
        prismaAction: params.action,
        args: sanitizeForAudit(params.args),
      };
      try {
        await this.prisma.auditLog.create({
          data: {
            actorUserId: actor.actorUserId,
            actorOrgId: actor.actorOrgId,
            impersonatedOrgId: actor.impersonatedOrgId,
            action: `${params.model}.${params.action}`,
            resourceType: params.model,
            resourceId,
            metadata: metadata as Prisma.InputJsonValue,
          },
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Otomatik denetim kaydı yazılamadı: ${message}`);
      }
      return result;
    });
  }

  async log(input: {
    actorUserId: string;
    actorOrgId: string;
    impersonatedOrgId?: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        actorOrgId: input.actorOrgId,
        impersonatedOrgId: input.impersonatedOrgId ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
