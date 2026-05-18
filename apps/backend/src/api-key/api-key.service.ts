import { randomBytes } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../prisma/prisma.service';

import type { ApiKeyAuthUser } from './api-key.types';
import type {
  ApiKeyListItemDto,
  CreatedApiKeyResponseDto,
} from './api-key.dto';

const BCRYPT_ROUNDS = 10;
const API_KEY_PREFIX = 'sk_live_';
const PREFIX_LEN = 12;

function readHeader(
  req: Request,
  name: 'authorization' | 'x-api-key',
): string | undefined {
  const raw = req.headers[name];
  if (Array.isArray(raw)) {
    return typeof raw[0] === 'string' ? raw[0] : undefined;
  }
  return typeof raw === 'string' ? raw : undefined;
}

function extractRawApiKeyFromRequest(req: Request): string | null {
  const xApi = readHeader(req, 'x-api-key');
  if (xApi?.startsWith(API_KEY_PREFIX)) {
    return xApi.trim();
  }
  const authz = readHeader(req, 'authorization');
  if (
    typeof authz === 'string' &&
    authz.startsWith('Bearer ') &&
    authz.slice(7).trim().startsWith(API_KEY_PREFIX)
  ) {
    return authz.slice(7).trim();
  }
  return null;
}

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

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
    const rawKey = `${API_KEY_PREFIX}${secretHex}`;
    const keyHash = await bcrypt.hash(rawKey, BCRYPT_ROUNDS);
    const keyPrefix = rawKey.substring(0, PREFIX_LEN);

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
    const token = extractRawApiKeyFromRequest(req);
    if (token == null || token.length < PREFIX_LEN + 8) {
      return null;
    }

    const prefix = token.substring(0, PREFIX_LEN);
    const candidates = await this.prisma.apiKey.findMany({
      where: {
        keyPrefix: prefix,
        isActive: true,
        organization: { deletedAt: null },
      },
      include: { organization: true },
      take: 8,
    });

    let row: (typeof candidates)[0] | null = null;
    for (const c of candidates) {
      const match = await bcrypt.compare(token, c.keyHash);
      if (match) {
        row = c;
        break;
      }
    }

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
