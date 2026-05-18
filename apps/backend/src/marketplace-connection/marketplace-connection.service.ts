import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Marketplace, type MarketplaceConnection } from '@prisma/client';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';

import type {
  CreateConnectionDto,
  TestConnectionDto,
  UpdateConnectionDto,
} from './marketplace-connection.dto';

export type PublicMarketplaceConnection = Omit<
  MarketplaceConnection,
  'credentialsEnc' | 'webhookSecret'
> & { accountLabel: string | null };

@Injectable()
export class MarketplaceConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly adapterRegistry: AdapterRegistry,
  ) {}

  private parseCredentialsRecord(
    credentialsEnc: string,
  ): Record<string, string> | null {
    try {
      const json = this.encryptionService.decrypt(credentialsEnc);
      const parsed: unknown = JSON.parse(json);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return null;
      }
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string') {
          out[k] = v;
        }
      }
      return out;
    } catch {
      return null;
    }
  }

  private accountLabel(
    platform: Marketplace,
    creds: Record<string, string> | null,
  ): string | null {
    if (!creds) {
      return null;
    }
    if (platform === Marketplace.TRENDYOL) {
      return creds.sellerId ?? null;
    }
    if (platform === Marketplace.HEPSIBURADA) {
      return creds.username ?? null;
    }
    if (platform === Marketplace.TSOFT) {
      return creds.storeUrl ?? null;
    }
    if (platform === Marketplace.TICIMAX) {
      return creds.siteUrl ?? null;
    }
    if (platform === Marketplace.N11) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.CICEKSEPETI) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.IDEASOFT) {
      return creds.storeUrl ?? null;
    }
    if (platform === Marketplace.AMAZON_TR) {
      return creds.sellerId ?? null;
    }
    if (platform === Marketplace.PTTAVM) {
      return creds.storeId ?? null;
    }
    if (platform === Marketplace.WOOCOMMERCE) {
      return creds.storeUrl ?? null;
    }
    if (platform === Marketplace.SHOPIFY) {
      return creds.shopDomain ?? null;
    }
    return null;
  }

  private toPublic(row: MarketplaceConnection): PublicMarketplaceConnection {
    const creds = this.parseCredentialsRecord(row.credentialsEnc);
    return {
      id: row.id,
      organizationId: row.organizationId,
      platform: row.platform,
      isActive: row.isActive,
      lastSyncAt: row.lastSyncAt,
      lastSyncMeta: row.lastSyncMeta,
      syncErrorCount: row.syncErrorCount,
      lastErrorAt: row.lastErrorAt,
      lastErrorMessage: row.lastErrorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      accountLabel: this.accountLabel(row.platform, creds),
    };
  }

  async findAll(organizationId: string): Promise<PublicMarketplaceConnection[]> {
    const rows = await this.prisma.marketplaceConnection.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<PublicMarketplaceConnection> {
    const row = await this.prisma.marketplaceConnection.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Pazaryeri bağlantısı bulunamadı');
    }
    return this.toPublic(row);
  }

  async create(
    organizationId: string,
    dto: CreateConnectionDto,
  ): Promise<PublicMarketplaceConnection> {
    const existing = await this.prisma.marketplaceConnection.findFirst({
      where: { organizationId, platform: dto.platform },
    });
    if (existing && existing.deletedAt === null) {
      throw new ConflictException(
        'Bu pazaryeri için zaten aktif bir bağlantı mevcut',
      );
    }
    const credentialsEnc = this.encryptionService.encrypt(
      JSON.stringify(dto.credentials),
    );
    if (existing) {
      const row = await this.prisma.marketplaceConnection.update({
        where: { id: existing.id },
        data: {
          credentialsEnc,
          deletedAt: null,
          isActive: true,
          syncErrorCount: 0,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });
      return this.toPublic(row);
    }
    const row = await this.prisma.marketplaceConnection.create({
      data: {
        organizationId,
        platform: dto.platform,
        credentialsEnc,
      },
    });
    return this.toPublic(row);
  }

  async testConnection(
    organizationId: string,
    dto: TestConnectionDto,
  ): Promise<{ connected: boolean }> {
    if (dto.connectionId) {
      const row = await this.prisma.marketplaceConnection.findFirst({
        where: { id: dto.connectionId, organizationId, deletedAt: null },
      });
      if (!row) {
        throw new NotFoundException('Pazaryeri bağlantısı bulunamadı');
      }
      const creds = this.parseCredentialsRecord(row.credentialsEnc);
      if (!creds) {
        return { connected: false };
      }
      const adapter = this.adapterRegistry.get(row.platform);
      const connected = await adapter.testConnection(creds);
      return { connected };
    }
    if (dto.platform === undefined || dto.credentials === undefined) {
      throw new BadRequestException(
        'connectionId veya platform+credentials gönderilmelidir.',
      );
    }
    const adapter = this.adapterRegistry.get(dto.platform);
    const connected = await adapter.testConnection(dto.credentials);
    return { connected };
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateConnectionDto,
  ): Promise<PublicMarketplaceConnection> {
    const row = await this.prisma.marketplaceConnection.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Pazaryeri bağlantısı bulunamadı');
    }
    let credentialsEnc = row.credentialsEnc;
    if (dto.credentials !== undefined) {
      const current = this.parseCredentialsRecord(row.credentialsEnc) ?? {};
      const merged: Record<string, string> = { ...current };
      for (const [k, v] of Object.entries(dto.credentials)) {
        if (typeof v === 'string' && v.trim().length > 0) {
          merged[k] = v.trim();
        }
      }
      credentialsEnc = this.encryptionService.encrypt(JSON.stringify(merged));
    }
    const updated = await this.prisma.marketplaceConnection.update({
      where: { id: row.id },
      data: {
        credentialsEnc,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toPublic(updated);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const row = await this.prisma.marketplaceConnection.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Pazaryeri bağlantısı bulunamadı');
    }
    await this.prisma.marketplaceConnection.update({
      where: { id: row.id },
      data: { deletedAt: new Date() },
    });
  }

  async registerWebhook(
    organizationId: string,
    connectionId: string,
  ): Promise<{ webhookUrl: string }> {
    const row = await this.prisma.marketplaceConnection.findFirst({
      where: { id: connectionId, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('Pazaryeri bağlantısı bulunamadı');
    }
    const secret = randomBytes(32).toString('hex');
    const webhookSecretEnc = this.encryptionService.encrypt(secret);
    await this.prisma.marketplaceConnection.update({
      where: { id: row.id },
      data: { webhookSecret: webhookSecretEnc },
    });
    const base = (process.env.APP_URL ?? 'http://localhost:3001').replace(
      /\/$/,
      '',
    );
    const webhookUrl = `${base}/api/v1/webhooks/${row.platform.toLowerCase()}/${connectionId}`;
    return { webhookUrl };
  }

  /**
   * İş kuyruğu: şifreli kimlik bilgisini çözüp döner (loglanmaz).
   */
  async getDecryptedCredentialsForJob(
    organizationId: string,
    platform: Marketplace,
  ): Promise<Record<string, string> | null> {
    const row = await this.prisma.marketplaceConnection.findFirst({
      where: {
        organizationId,
        platform,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!row) {
      return null;
    }
    return this.parseCredentialsRecord(row.credentialsEnc);
  }
}
