import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';

import { CacheKeys } from '../common/cache/cache-keys';
import { CACHE_TTL } from '../common/cache/cache-ttl';
import { CacheService } from '../common/cache/cache.service';

import type { MigrationSession } from './migration.types';

@Injectable()
export class MigrationSessionStore {
  private readonly memory = new Map<string, MigrationSession>();

  constructor(private readonly cache: CacheService) {}

  async create(
    partial: Omit<
      MigrationSession,
      'id' | 'createdAt' | 'updatedAt' | 'columnMapping' | 'progress' | 'rowErrors' | 'status'
    > & { status?: MigrationSession['status'] },
  ): Promise<MigrationSession> {
    const now = new Date().toISOString();
    const session: MigrationSession = {
      id: randomUUID(),
      columnMapping: {},
      status: partial.status ?? 'uploaded',
      progress: {
        processed: 0,
        total: partial.rawRows.length,
        imported: 0,
        updated: 0,
        skipped: 0,
        failed: 0,
      },
      rowErrors: [],
      createdAt: now,
      updatedAt: now,
      ...partial,
    };
    await this.save(session);
    return session;
  }

  async get(sessionId: string, organizationId: string): Promise<MigrationSession> {
    const session = await this.load(sessionId);
    if (!session || session.organizationId !== organizationId) {
      throw new NotFoundException('Veri taşıma oturumu bulunamadı');
    }
    return session;
  }

  async update(
    sessionId: string,
    organizationId: string,
    patch: Partial<MigrationSession>,
  ): Promise<MigrationSession> {
    const current = await this.get(sessionId, organizationId);
    const updated: MigrationSession = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.save(updated);
    return updated;
  }

  private async save(session: MigrationSession): Promise<void> {
    const key = CacheKeys.migrationSession(session.id);
    this.memory.set(session.id, session);
    await this.cache.set(key, session, CACHE_TTL.MIGRATION_SESSION);
  }

  private async load(sessionId: string): Promise<MigrationSession | null> {
    const mem = this.memory.get(sessionId);
    if (mem) {
      return mem;
    }
    const key = CacheKeys.migrationSession(sessionId);
    const cached = await this.cache.get<MigrationSession>(key);
    if (cached) {
      this.memory.set(sessionId, cached);
    }
    return cached;
  }
}
