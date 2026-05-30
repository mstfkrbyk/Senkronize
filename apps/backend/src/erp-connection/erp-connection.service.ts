import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ErpConnectionRole, ErpType, type ErpConnection } from '@prisma/client';
import type { ERPConnectionResult } from '@senkronize/shared';

import { AdapterRegistry } from '../adapters/adapter.registry';
import { BizimHesapErpAdapter } from '../adapters/erp/bizimhesap/bizimhesap.adapter';
import {
  setOrganizationAccountingModeExternal,
  syncOrganizationAccountingModeFromErp,
} from '../common/accounting-mode';
import { EncryptionService } from '../common/encryption/encryption.service';
import { ErpSyncSettingsService } from '../erp/erp-sync-settings.service';
import { isInternalAccount } from '../organization/organization-internal';
import { PrismaService } from '../prisma/prisma.service';

import type {
  CreateErpConnectionDto,
  TestErpConnectionDto,
  UpdateErpConnectionDto,
} from './erp-connection.dto';
import { validateAndNormalizeErpCredentials } from './erp-credentials.schema';
import { resolveRoleForNewConnection } from './erp-connection-role.util';
import { effectiveErpSlotLimit } from './erp-slot-limit.util';

export type PublicErpConnection = Omit<ErpConnection, 'credentialsEnc'> & {
  accountLabel: string | null;
};

@Injectable()
export class ErpConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly adapterRegistry: AdapterRegistry,
    private readonly erpSyncSettingsService: ErpSyncSettingsService,
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
      return creds.defaultCustomerCode ?? creds.apiVersion ?? null;
    }
    if (erpType === ErpType.TSOFT) {
      return creds.storeUrl ?? null;
    }
    if (erpType === ErpType.TICIMAX) {
      return creds.storeUrl ?? creds.siteUrl ?? null;
    }
    if (erpType === ErpType.PARASUT) {
      return creds.companyId ?? null;
    }
    if (erpType === ErpType.LOGO || erpType === ErpType.MIKRO || erpType === ErpType.NETSIS) {
      return creds.baseUrl ?? null;
    }
    if (erpType === ErpType.LUCA) {
      return creds.companyId ?? null;
    }
    if (
      erpType === ErpType.ETA ||
      erpType === ErpType.ZIRVE ||
      erpType === ErpType.NEBIM ||
      erpType === ErpType.SAP_B1 ||
      erpType === ErpType.ISNET
    ) {
      return creds.baseUrl ?? creds.host ?? null;
    }
    if (erpType === ErpType.KOLAYBI) {
      return creds.companyName ?? creds.workspaceId ?? null;
    }
    if (erpType === ErpType.EBA) {
      return creds.clientId ?? null;
    }
    if (erpType === ErpType.MYSOFT) {
      return creds.username ?? creds.baseUrl ?? null;
    }
    if (erpType === ErpType.PROTEL) {
      return creds.baseUrl ?? (creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null);
    }
    if (erpType === ErpType.SIMPRA) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (erpType === ErpType.LOGO_COMMERCE) {
      return creds.baseUrl ?? creds.firmNo ?? null;
    }
    if (erpType === ErpType.BIZIM_MUHASEBE) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (erpType === ErpType.LOGO_CLOUD) {
      return creds.clientId ?? creds.baseUrl ?? null;
    }
    if (erpType === ErpType.FINANS_MUHASEBE) {
      return creds.companyId ?? null;
    }
    if (erpType === ErpType.MIKRO_BULUT) {
      return creds.company ?? creds.companyId ?? creds.username ?? null;
    }
    if (erpType === ErpType.NETSUITE) {
      return creds.accountId ?? creds.baseUrl ?? null;
    }
    if (erpType === ErpType.DYNAMICS365) {
      return creds.companyId ?? creds.tenantId ?? null;
    }
    if (erpType === ErpType.ODOO) {
      return creds.instance ?? creds.db ?? null;
    }
    if (erpType === ErpType.EPICOR) {
      return creds.company ?? creds.server ?? creds.baseUrl ?? null;
    }
    if (erpType === ErpType.IQRA_ERP) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (erpType === ErpType.QUICKBOOKS) {
      return creds.companyId ?? null;
    }
    if (erpType === ErpType.XERO) {
      return creds.tenantId ?? null;
    }
    if (erpType === ErpType.SAGE50) {
      return creds.baseUrl ?? null;
    }
    if (erpType === ErpType.LIGHTSPEED) {
      return creds.accountId ?? creds.accountID ?? null;
    }
    if (erpType === ErpType.VEND_POS) {
      return creds.domainPrefix ?? creds.domain_prefix ?? null;
    }
    return null;
  }

  private toPublic(row: ErpConnection): PublicErpConnection {
    const creds = this.parseCredentialsRecord(row.credentialsEnc);
    return {
      id: row.id,
      organizationId: row.organizationId,
      erpType: row.erpType,
      displayName: row.displayName,
      role: row.role,
      isActive: row.isActive,
      lastSyncAt: row.lastSyncAt,
      syncErrorCount: row.syncErrorCount,
      lastErrorAt: row.lastErrorAt,
      lastErrorMessage: row.lastErrorMessage,
      productMatchKey: row.productMatchKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      accountLabel: this.accountLabel(row.erpType, creds),
    };
  }

  private normalizeDisplayName(value: string | undefined): string | null {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed.slice(0, 120) : null;
  }

  private async assertCanAddErpConnection(organizationId: string): Promise<void> {
    const [org, subscription, activeCount] = await Promise.all([
      this.prisma.organization.findFirst({
        where: { id: organizationId, deletedAt: null },
        select: { metadata: true, slug: true },
      }),
      this.prisma.subscription.findUnique({
        where: { organizationId },
        select: { addons: true },
      }),
      this.prisma.erpConnection.count({
        where: { organizationId, deletedAt: null, isActive: true },
      }),
    ]);
    const limit = effectiveErpSlotLimit({
      subscription,
      isInternalAccount: org ? isInternalAccount(org) : false,
    });
    if (limit !== null && activeCount >= limit) {
      throw new HttpException(
        'ERP bağlantı limitine ulaştınız. Ek ERP modülü satın alarak yeni bağlantı ekleyebilirsiniz.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
  }

  async findPrimaryConnection(
    organizationId: string,
  ): Promise<ErpConnection | null> {
    return this.prisma.erpConnection.findFirst({
      where: {
        organizationId,
        role: ErpConnectionRole.PRIMARY,
        deletedAt: null,
        isActive: true,
      },
    });
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
    await this.assertCanAddErpConnection(organizationId);

    const primary = await this.findPrimaryConnection(organizationId);
    const role = resolveRoleForNewConnection(
      primary !== null,
      dto.role,
    );

    const normalizedCredentials = validateAndNormalizeErpCredentials(
      dto.erpType,
      dto.credentials,
    );
    const credentialsEnc = this.encryptionService.encrypt(
      JSON.stringify(normalizedCredentials),
    );
    const row = await this.prisma.erpConnection.create({
      data: {
        organizationId,
        erpType: dto.erpType,
        credentialsEnc,
        role,
        displayName: this.normalizeDisplayName(dto.displayName),
      },
    });
    await this.erpSyncSettingsService.createDefaultForConnection(
      organizationId,
      row.id,
    );
    if (row.isActive) {
      await setOrganizationAccountingModeExternal(this.prisma, organizationId);
    }
    return this.toPublic(row);
  }

  async testConnectionById(
    organizationId: string,
    connectionId: string,
  ): Promise<{
    success: boolean;
    responseTimeMs: number;
    version?: string;
    productCount?: number;
    error?: string;
  }> {
    const row = await this.prisma.erpConnection.findFirst({
      where: { id: connectionId, organizationId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException('ERP bağlantısı bulunamadı');
    }
    const started = Date.now();
    if (!this.adapterRegistry.hasErpAdapter(row.erpType)) {
      return {
        success: false,
        responseTimeMs: Date.now() - started,
        error: 'Bu ERP türü için adaptör tanımlı değil.',
      };
    }
    const creds = this.parseCredentialsRecord(row.credentialsEnc);
    if (!creds) {
      return {
        success: false,
        responseTimeMs: Date.now() - started,
        error: 'Kimlik bilgileri çözülemedi.',
      };
    }
    try {
      const adapter = this.adapterRegistry.getErp(row.erpType);
      const testResult =
        row.erpType === ErpType.BIZIMHESAP
          ? await (adapter as BizimHesapErpAdapter).testConnection(creds, organizationId)
          : await adapter.testConnection(creds);
      if (!testResult.success) {
        return {
          success: false,
          responseTimeMs: Date.now() - started,
          version: testResult.version,
          error: testResult.message ?? 'Bağlantı testi başarısız.',
        };
      }
      if (row.erpType === ErpType.BIZIMHESAP) {
        return {
          success: true,
          responseTimeMs: Date.now() - started,
          version: testResult.version,
        };
      }
      const products = await adapter.getProducts(creds);
      const sampleCount = Math.min(products.length, 1);
      return {
        success: true,
        responseTimeMs: Date.now() - started,
        version: testResult.version,
        productCount: sampleCount > 0 ? products.length : 0,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Bağlantı testi başarısız.';
      return {
        success: false,
        responseTimeMs: Date.now() - started,
        error: message.slice(0, 500),
      };
    }
  }

  async testConnection(
    organizationId: string,
    dto: TestErpConnectionDto,
  ): Promise<ERPConnectionResult & { connected: boolean }> {
    if (dto.connectionId) {
      const row = await this.prisma.erpConnection.findFirst({
        where: { id: dto.connectionId, organizationId, deletedAt: null },
      });
      if (!row) {
        throw new NotFoundException('ERP bağlantısı bulunamadı');
      }
      if (!this.adapterRegistry.hasErpAdapter(row.erpType)) {
        return { success: false, connected: false };
      }
      const creds = this.parseCredentialsRecord(row.credentialsEnc);
      if (!creds) {
        return { success: false, connected: false };
      }
      const adapter = this.adapterRegistry.getErp(row.erpType);
      const result =
        row.erpType === ErpType.BIZIMHESAP
          ? await (adapter as BizimHesapErpAdapter).testConnection(creds, organizationId)
          : await adapter.testConnection(creds);
      return { ...result, connected: result.success };
    }
    if (dto.erpType === undefined || dto.credentials === undefined) {
      throw new BadRequestException(
        'connectionId veya erpType+credentials gönderilmelidir.',
      );
    }
    if (!this.adapterRegistry.hasErpAdapter(dto.erpType)) {
      return { success: false, connected: false };
    }
    const normalizedCredentials = validateAndNormalizeErpCredentials(
      dto.erpType,
      dto.credentials,
    );
    const adapter = this.adapterRegistry.getErp(dto.erpType);
    const result = await adapter.testConnection(normalizedCredentials);
    return { ...result, connected: result.success };
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
      const normalized = validateAndNormalizeErpCredentials(row.erpType, merged);
      credentialsEnc = this.encryptionService.encrypt(JSON.stringify(normalized));
    }
    const updated = await this.prisma.erpConnection.update({
      where: { id: row.id },
      data: {
        credentialsEnc,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.displayName !== undefined
          ? { displayName: this.normalizeDisplayName(dto.displayName) }
          : {}),
        ...(dto.productMatchKey !== undefined
          ? { productMatchKey: dto.productMatchKey }
          : {}),
      },
    });
    if (updated.isActive) {
      await setOrganizationAccountingModeExternal(this.prisma, organizationId);
    } else {
      await syncOrganizationAccountingModeFromErp(this.prisma, organizationId);
    }
    return this.toPublic(updated);
  }

  async setPrimaryRole(
    organizationId: string,
    connectionId: string,
  ): Promise<PublicErpConnection> {
    const target = await this.prisma.erpConnection.findFirst({
      where: { id: connectionId, organizationId, deletedAt: null },
    });
    if (!target) {
      throw new NotFoundException('ERP bağlantısı bulunamadı');
    }
    if (target.role === ErpConnectionRole.PRIMARY) {
      return this.toPublic(target);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const currentPrimary = await tx.erpConnection.findFirst({
        where: {
          organizationId,
          role: ErpConnectionRole.PRIMARY,
          deletedAt: null,
        },
      });
      if (currentPrimary) {
        await tx.erpConnection.update({
          where: { id: currentPrimary.id },
          data: { role: ErpConnectionRole.SECONDARY },
        });
        await this.erpSyncSettingsService.applySecondarySyncProfile(
          organizationId,
          currentPrimary.id,
          tx,
        );
      }
      const promoted = await tx.erpConnection.update({
        where: { id: target.id },
        data: { role: ErpConnectionRole.PRIMARY },
      });
      await this.erpSyncSettingsService.applyPrimarySyncProfile(
        organizationId,
        target.id,
        tx,
      );
      return promoted;
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
    await this.prisma.$transaction(async (tx) => {
      await tx.erpConnection.update({
        where: { id: row.id },
        data: { deletedAt: new Date() },
      });
      if (row.role === ErpConnectionRole.PRIMARY) {
        const nextPrimary = await tx.erpConnection.findFirst({
          where: {
            organizationId,
            deletedAt: null,
            isActive: true,
            id: { not: row.id },
          },
          orderBy: { createdAt: 'asc' },
        });
        if (nextPrimary) {
          await tx.erpConnection.update({
            where: { id: nextPrimary.id },
            data: { role: ErpConnectionRole.PRIMARY },
          });
          await this.erpSyncSettingsService.applyPrimarySyncProfile(
            organizationId,
            nextPrimary.id,
            tx,
          );
        }
      }
    });
    await syncOrganizationAccountingModeFromErp(this.prisma, organizationId);
  }

  /**
   * İş kuyruğu: şifreli kimlik bilgisini çözüp döner (loglanmaz).
   */
  async getDecryptedCredentialsForJob(
    organizationId: string,
    erpType: ErpType,
    erpConnectionId?: string,
  ): Promise<Record<string, string> | null> {
    let row: ErpConnection | null = null;
    if (erpConnectionId) {
      row = await this.prisma.erpConnection.findFirst({
        where: {
          id: erpConnectionId,
          organizationId,
          deletedAt: null,
          isActive: true,
        },
      });
    }
    if (!row) {
      row = await this.prisma.erpConnection.findFirst({
        where: {
          organizationId,
          erpType,
          deletedAt: null,
          isActive: true,
        },
      });
    }
    if (!row) {
      return null;
    }
    const creds = this.parseCredentialsRecord(row.credentialsEnc);
    if (!creds) {
      return null;
    }
    return { ...creds, organizationId };
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

  async recordSyncSuccess(
    organizationId: string,
    erpConnectionId: string,
  ): Promise<void> {
    const conn = await this.prisma.erpConnection.findFirst({
      where: {
        id: erpConnectionId,
        organizationId,
        deletedAt: null,
      },
    });
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
    erpConnectionId: string,
    errorMessage?: string,
  ): Promise<void> {
    const conn = await this.prisma.erpConnection.findFirst({
      where: {
        id: erpConnectionId,
        organizationId,
        deletedAt: null,
      },
    });
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

  async syncOrderToErp(
    connectionId: string,
    orderId: string,
    organizationId: string,
    actorUserId: string,
    actorOrgId: string,
    isImpersonating: boolean,
    impersonatedOrgId: string | null,
  ): Promise<{ invoiceNo: string }> {
    const connection = await this.prisma.erpConnection.findFirst({
      where: { id: connectionId, organizationId, deletedAt: null },
    });
    if (!connection) {
      throw new NotFoundException('ERP bağlantısı bulunamadı');
    }
    if (connection.role !== ErpConnectionRole.PRIMARY) {
      throw new BadRequestException(
        'Fatura yalnızca birincil ERP bağlantısına gönderilebilir.',
      );
    }
    if (!this.adapterRegistry.hasErpAdapter(connection.erpType)) {
      throw new BadRequestException(
        'Bu ERP türü için fatura gönderimi desteklenmiyor.',
      );
    }
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId, deletedAt: null },
      include: { items: true },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }
    const creds = this.parseCredentialsRecord(connection.credentialsEnc);
    if (!creds) {
      throw new BadRequestException('ERP kimlik bilgileri çözülemedi.');
    }
    const adapter = this.adapterRegistry.getErp(connection.erpType);
    const lines = order.items.map((item) => {
      const unit = Number(item.unitPrice);
      const qty = item.quantity;
      const lineTotal = Math.round(unit * qty * 100) / 100;
      return {
        description: item.productName ?? item.sku,
        sku: item.sku,
        quantity: qty,
        unitPrice: unit,
        taxRate: 0,
        total: lineTotal,
      };
    });
    const invoice = await adapter.createInvoice(
      { ...creds, organizationId },
      {
        orderRef: order.platformOrderId,
        customerName: order.customerName,
        totalAmount: Number(order.totalAmount),
        currency: order.currency,
        lines,
      },
    );
    await this.prisma.auditLog.create({
      data: {
        actorUserId,
        actorOrgId,
        impersonatedOrgId: isImpersonating ? impersonatedOrgId : null,
        action: 'erp.invoice_created',
        resourceType: 'Order',
        resourceId: orderId,
        metadata: {
          invoiceNo: invoice.invoiceNumber,
          connectionId,
          erpType: connection.erpType,
        },
      },
    });
    return { invoiceNo: invoice.invoiceNumber };
  }
}
