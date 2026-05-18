import { createHash, randomBytes } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

import { PrismaService } from '../prisma/prisma.service';

import type { ApiKeyAuthUser } from './api-key.types';
import type {
  ApiKeyListItemDto,
  CreatedApiKeyResponseDto,
} from './api-key.dto';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

@Injectable()
export class ApiKeyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private keyPrefixForSecret(secretHex: string): string {
    return secretHex.slice(0, 8);
  }

  private buildRawKey(secretHex: string): string {
    const isProd = this.config.get<string>('NODE_ENV') === 'production';
    const envPart = isProd ? 'live' : 'test';
    return `skr_${envPart}_${secretHex}`;
  }

  async listActive(organizationId: string): Promise<ApiKeyListItemDto[]> {
    const rows = await this.prisma.apiKey.findMany({
      where: { organizationId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      keyPrefix: r.keyPrefix,
      lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async create(
    organizationId: string,
    name: string,
  ): Promise<CreatedApiKeyResponseDto> {
    const secretHex = randomBytes(16).toString('hex');
    const rawKey = this.buildRawKey(secretHex);
    const keyHash = sha256Hex(rawKey);
    const keyPrefix = this.keyPrefixForSecret(secretHex);

    const row = await this.prisma.apiKey.create({
      data: {
        organizationId,
        name: name.trim(),
        keyHash,
        keyPrefix,
      },
    });

    return {
      id: row.id,
      name: row.name,
      keyPrefix: row.keyPrefix,
      key: rawKey,
    };
  }

  async softDisable(organizationId: string, id: string): Promise<void> {
    const result = await this.prisma.apiKey.updateMany({
      where: { id, organizationId, isActive: true },
      data: { isActive: false },
    });
    if (result.count === 0) {
      throw new NotFoundException('API anahtarı bulunamadı veya zaten devre dışı');
    }
  }

  /**
   * Passport custom strategy: doğrula ve `request.user` için payload üret.
   */
  async authenticateRequest(req: Request): Promise<ApiKeyAuthUser | null> {
    const rawHeader = req.headers['x-api-key'];
    const token = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    if (typeof token !== 'string' || token.length < 16 || !token.startsWith('skr_')) {
      return null;
    }

    const keyHash = sha256Hex(token);
    const row = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
        organization: { deletedAt: null },
      },
      include: { organization: true },
    });
    if (!row) {
      return null;
    }

    if (row.expiresAt != null && row.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    await this.prisma.apiKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      currentOrgId: row.organizationId,
      isImpersonating: false,
      apiKeyId: row.id,
    };
  }
}
