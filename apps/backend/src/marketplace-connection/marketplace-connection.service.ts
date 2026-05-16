import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Marketplace, type MarketplaceConnection } from '@prisma/client';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';

import type { CreateConnectionDto, TestConnectionDto, UpdateConnectionDto } from './marketplace-connection.dto';

export type PublicMarketplaceConnection = Omit<
  MarketplaceConnection,
  'credentialsEnc' | 'webhookSecret'
>;

@Injectable()
export class MarketplaceConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly adapterRegistry: AdapterRegistry,
  ) {}

  private toPublic(row: MarketplaceConnection): PublicMarketplaceConnection {
    return {
      id: row.id,
      organizationId: row.organizationId,
      platform: row.platform,
      isActive: row.isActive,
      lastSyncAt: row.lastSyncAt,
      syncErrorCount: row.syncErrorCount,
      lastErrorAt: row.lastErrorAt,
      lastErrorMessage: row.lastErrorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
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

  async testConnection(dto: TestConnectionDto): Promise<{ connected: boolean }> {
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
      credentialsEnc = this.encryptionService.encrypt(
        JSON.stringify(dto.credentials),
      );
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
    const json = this.encryptionService.decrypt(row.credentialsEnc);
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') {
        out[k] = v;
      }
    }
    return out;
  }
}
