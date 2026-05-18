import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ErpType, type ErpConnection } from '@prisma/client';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';

import type {
  CreateErpConnectionDto,
  TestErpConnectionDto,
  UpdateErpConnectionDto,
} from './erp-connection.dto';

export type PublicErpConnection = Omit<ErpConnection, 'credentialsEnc'> & {
  accountLabel: string | null;
};

@Injectable()
export class ErpConnectionService {
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
    erpType: ErpType,
    creds: Record<string, string> | null,
  ): string | null {
    if (!creds) {
      return null;
    }
    if (erpType === ErpType.BIZIMHESAP) {
      return creds.companyId ?? null;
    }
    if (erpType === ErpType.TSOFT) {
      return creds.storeUrl ?? null;
    }
    if (erpType === ErpType.TICIMAX) {
      return creds.siteUrl ?? null;
    }
    if (erpType === ErpType.PARASUT) {
      return creds.companyId ?? null;
    }
    if (erpType === ErpType.LOGO || erpType === ErpType.MIKRO) {
      return creds.baseUrl ?? null;
    }
    if (erpType === ErpType.LUCA) {
      return creds.companyId ?? null;
    }
    return null;
  }

  private toPublic(row: ErpConnection): PublicErpConnection {
    const creds = this.parseCredentialsRecord(row.credentialsEnc);
    return {
      id: row.id,
      organizationId: row.organizationId,
      erpType: row.erpType,
      isActive: row.isActive,
      lastSyncAt: row.lastSyncAt,
      syncErrorCount: row.syncErrorCount,
      lastErrorAt: row.lastErrorAt,
      lastErrorMessage: row.lastErrorMessage,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      accountLabel: this.accountLabel(row.erpType, creds),
    };
  }

  async findAll(organizationId: string): Promise<PublicErpConnection[]> {
    const rows = await this.prisma.erpConnection.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toPublic(r));
  }

  async findOne(organizationId: string, id: string): Promise<PublicErpConnection> {
    const row = await this.prisma.erpConnection.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('ERP bağlantısı bulunamadı');
    }
    return this.toPublic(row);
  }

  async create(
    organizationId: string,
    dto: CreateErpConnectionDto,
  ): Promise<PublicErpConnection> {
    if (!this.adapterRegistry.hasErpAdapter(dto.erpType)) {
      throw new BadRequestException(
        'Bu ERP türü için henüz bir adaptör tanımlı değil veya desteklenmiyor.',
      );
    }
    const existing = await this.prisma.erpConnection.findFirst({
      where: { organizationId, erpType: dto.erpType },
    });
    if (existing && existing.deletedAt === null) {
      throw new ConflictException('Bu ERP için zaten aktif bir bağlantı mevcut');
    }
    const credentialsEnc = this.encryptionService.encrypt(
      JSON.stringify(dto.credentials),
    );
    if (existing) {
      const row = await this.prisma.erpConnection.update({
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
    const row = await this.prisma.erpConnection.create({
      data: {
        organizationId,
        erpType: dto.erpType,
        credentialsEnc,
      },
    });
    return this.toPublic(row);
  }

  async testConnection(
    organizationId: string,
    dto: TestErpConnectionDto,
  ): Promise<{ connected: boolean }> {
    if (dto.connectionId) {
      const row = await this.prisma.erpConnection.findFirst({
        where: { id: dto.connectionId, organizationId, deletedAt: null },
      });
      if (!row) {
        throw new NotFoundException('ERP bağlantısı bulunamadı');
      }
      if (!this.adapterRegistry.hasErpAdapter(row.erpType)) {
        return { connected: false };
      }
      const creds = this.parseCredentialsRecord(row.credentialsEnc);
      if (!creds) {
        return { connected: false };
      }
      const adapter = this.adapterRegistry.getErp(row.erpType);
      const connected = await adapter.testConnection(creds);
      return { connected };
    }
    if (dto.erpType === undefined || dto.credentials === undefined) {
      throw new BadRequestException(
        'connectionId veya erpType+credentials gönderilmelidir.',
      );
    }
    if (!this.adapterRegistry.hasErpAdapter(dto.erpType)) {
      return { connected: false };
    }
    const adapter = this.adapterRegistry.getErp(dto.erpType);
    const connected = await adapter.testConnection(dto.credentials);
    return { connected };
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateErpConnectionDto,
  ): Promise<PublicErpConnection> {
    const row = await this.prisma.erpConnection.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('ERP bağlantısı bulunamadı');
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
    const updated = await this.prisma.erpConnection.update({
      where: { id: row.id },
      data: {
        credentialsEnc,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.toPublic(updated);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const row = await this.prisma.erpConnection.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('ERP bağlantısı bulunamadı');
    }
    await this.prisma.erpConnection.update({
      where: { id: row.id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * İş kuyruğu: şifreli kimlik bilgisini çözüp döner (loglanmaz).
   */
  async getDecryptedCredentialsForJob(
    organizationId: string,
    erpType: ErpType,
  ): Promise<Record<string, string> | null> {
    const row = await this.prisma.erpConnection.findFirst({
      where: {
        organizationId,
        erpType,
        deletedAt: null,
        isActive: true,
      },
    });
    if (!row) {
      return null;
    }
    return this.parseCredentialsRecord(row.credentialsEnc);
  }

  async findActiveByOrgAndType(
    organizationId: string,
    erpType: ErpType,
  ): Promise<ErpConnection | null> {
    return this.prisma.erpConnection.findFirst({
      where: {
        organizationId,
        erpType,
        deletedAt: null,
        isActive: true,
      },
    });
  }

  async recordSyncSuccess(organizationId: string, erpType: ErpType): Promise<void> {
    const conn = await this.findActiveByOrgAndType(organizationId, erpType);
    if (!conn) {
      return;
    }
    await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: {
        lastSyncAt: new Date(),
        syncErrorCount: 0,
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });
  }

  async recordSyncError(
    organizationId: string,
    erpType: ErpType,
    errorMessage?: string,
  ): Promise<void> {
    const conn = await this.findActiveByOrgAndType(organizationId, erpType);
    if (!conn) {
      return;
    }
    await this.prisma.erpConnection.update({
      where: { id: conn.id },
      data: {
        syncErrorCount: { increment: 1 },
        lastErrorAt: new Date(),
        lastErrorMessage: errorMessage ? errorMessage.slice(0, 2000) : null,
      },
    });
  }
}
