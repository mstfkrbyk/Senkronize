import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Marketplace, type MarketplaceConnection } from '@prisma/client';

import { PostHogService } from '../analytics/posthog.service';
import { AdapterRegistry } from '../adapters/adapter.registry';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';

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
    private readonly subscriptionService: SubscriptionService,
    private readonly posthog: PostHogService,
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
    if (platform === Marketplace.CICEKSEPETI_EV) {
      return (
        creds.categoryId?.trim() ??
        creds.channelId?.trim() ??
        (creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null)
      );
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
    if (platform === Marketplace.GETIR) {
      return creds.merchantId ?? null;
    }
    if (platform === Marketplace.GRATIS || platform === Marketplace.MORHIPO) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.BOYNER) {
      return creds.clientId ?? null;
    }
    if (platform === Marketplace.DOLAP) {
      return creds.accessToken ? `${creds.accessToken.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.EBAY) {
      return creds.clientId ?? creds.sellerId ?? null;
    }
    if (platform === Marketplace.ETSY) {
      return creds.shopId ?? null;
    }
    if (platform === Marketplace.TEMU) {
      return creds.appKey ?? null;
    }
    if (platform === Marketplace.SAHIBINDEN) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.MIGROS) {
      return creds.merchantId ?? null;
    }
    if (platform === Marketplace.HEPSIEXPRESS || platform === Marketplace.DEFACTO) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.FLO || platform === Marketplace.KOTON) {
      return creds.accessToken ? `${creds.accessToken.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.LCWAIKIKI || platform === Marketplace.MEDIAMARKT) {
      return creds.clientId ?? creds.accessToken?.slice(0, 6) ?? null;
    }
    if (platform === Marketplace.VATAN || platform === Marketplace.TEKNOSA || platform === Marketplace.MAVI) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.ALLEGRO) {
      return creds.clientId ?? null;
    }
    if (platform === Marketplace.WILDBERRIES || platform === Marketplace.NOON) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.OZON) {
      return creds.clientId ?? null;
    }
    if (platform === Marketplace.AMAZON_EU || platform === Marketplace.AMAZON_AE) {
      return creds.sellerId ?? creds.marketplaceId ?? null;
    }
    if (platform === Marketplace.CDISCOUNT) {
      return creds.apiLogin ?? creds.apiKey ?? null;
    }
    if (platform === Marketplace.KAUFLAND) {
      return creds.accessKey ?? creds.clientId ?? null;
    }
    if (platform === Marketplace.TRENDYOL_GO) {
      return creds.supplierId ?? creds.merchantId ?? null;
    }
    if (
      platform === Marketplace.BANABI ||
      platform === Marketplace.VESTEL ||
      platform === Marketplace.BIMAKILLI ||
      platform === Marketplace.ROBOMARKT ||
      platform === Marketplace.FUUDY ||
      platform === Marketplace.EVIDEA
    ) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.A101) {
      return creds.merchantId ?? null;
    }
    if (platform === Marketplace.YEMEKSEPETI) {
      return (
        creds.merchantId ??
        creds.clientId ??
        (creds.accessToken ? `${creds.accessToken.slice(0, 6)}...` : null)
      );
    }
    if (platform === Marketplace.TRENDYOL_YEMEK) {
      return creds.supplierId ?? creds.apiKey ?? null;
    }
    if (platform === Marketplace.MODANISA) {
      return creds.sellerId ?? null;
    }
    if (platform === Marketplace.PORLAND) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (
      platform === Marketplace.ELEKTRA ||
      platform === Marketplace.MIGROSHEMEN ||
      platform === Marketplace.SHOPIGO ||
      platform === Marketplace.GETIR_FOOD ||
      platform === Marketplace.SEFAMERVE ||
      platform === Marketplace.ADDAX ||
      platform === Marketplace.LIDYANA ||
      platform === Marketplace.VIVENSE
    ) {
      return creds.accessToken ? `${creds.accessToken.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.ARCELIK) {
      return creds.clientId ?? null;
    }
    if (
      platform === Marketplace.ALIBABA ||
      platform === Marketplace.LAZADA ||
      platform === Marketplace.DARAZ ||
      platform === Marketplace.LAZADA_PH
    ) {
      return creds.appKey ?? null;
    }
    if (platform === Marketplace.SHOPEE) {
      return creds.partnerId ?? null;
    }
    if (
      platform === Marketplace.MADEINCHINA ||
      platform === Marketplace.SPORTIVE ||
      platform === Marketplace.MEESHO ||
      platform === Marketplace.ENPARA
    ) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.KITAPYURDU) {
      return creds.username ?? null;
    }
    if (platform === Marketplace.EXPORTIFY) {
      return creds.accessToken ? `${creds.accessToken.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.DR) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.TOKOPEDIA) {
      return creds.clientId ?? (creds.accessToken ? `${creds.accessToken.slice(0, 6)}...` : null);
    }
    if (platform === Marketplace.GITTIGIDIYOR) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (
      platform === Marketplace.NAMSHI ||
      platform === Marketplace.SNAPDEAL ||
      platform === Marketplace.QOO10 ||
      platform === Marketplace.MALL_CZ ||
      platform === Marketplace.PIGU ||
      platform === Marketplace.PRICERUNNER ||
      platform === Marketplace.OUNASS ||
      platform === Marketplace.SIVVI ||
      platform === Marketplace.IDEFIX
    ) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.CARREFOUR_ME) {
      return creds.clientId ?? null;
    }
    if (platform === Marketplace.JUMIA) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (
      platform === Marketplace.FLIPKART ||
      platform === Marketplace.MYNTRA ||
      platform === Marketplace.MERCADOLIBRE
    ) {
      return creds.accessToken ? `${creds.accessToken.slice(0, 6)}...` : creds.clientId ?? null;
    }
    if (platform === Marketplace.RAKUTEN) {
      return creds.licenseKey ?? null;
    }
    if (platform === Marketplace.HEPSIBURADA_PREMIUM) {
      return creds.username ?? creds.merchantId ?? null;
    }
    if (platform === Marketplace.TRENDYOL_PREMIUM) {
      return creds.sellerId ?? null;
    }
    if (platform === Marketplace.PAZARAMA_PREMIUM) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.N11_PRO) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (
      platform === Marketplace.OTTO ||
      platform === Marketplace.ZALANDO ||
      platform === Marketplace.IDEALO ||
      platform === Marketplace.ZARA
    ) {
      return creds.clientId ?? null;
    }
    if (
      platform === Marketplace.BOLCOM ||
      platform === Marketplace.EMAG ||
      platform === Marketplace.REALDE ||
      platform === Marketplace.DECATHLON
    ) {
      return creds.clientId ?? creds.username ?? creds.apiKey ?? null;
    }
    if (platform === Marketplace.GETIR_YEMEK || platform === Marketplace.SHOPIVERSE) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.LETGO) {
      return creds.accessToken ? `${creds.accessToken.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.SAHIBINDEN_PRO) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.SAHIBINDEN_PREMIUM) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (
      platform === Marketplace.BUKALAPAK ||
      platform === Marketplace.SENDO ||
      platform === Marketplace.YANDEX_MARKET
    ) {
      return creds.clientId ?? null;
    }
    if (
      platform === Marketplace.JDID ||
      platform === Marketplace.BLIBLI ||
      platform === Marketplace.CATCH_AU ||
      platform === Marketplace.MYDEAL ||
      platform === Marketplace.LAMODA
    ) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.TIKI) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.TRADEME) {
      return creds.consumerKey ?? null;
    }
    if (platform === Marketplace.MIGROS_SANAL) {
      return creds.supplierId ?? null;
    }
    if (
      platform === Marketplace.BIM_ONLINE ||
      platform === Marketplace.SOK_MARKET
    ) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (
      platform === Marketplace.CARREFOURSA ||
      platform === Marketplace.TAZE_DIREKT ||
      platform === Marketplace.INSTACART
    ) {
      return creds.accessToken ? `${creds.accessToken.slice(0, 6)}...` : null;
    }
    if (platform === Marketplace.GORILLAS) {
      return creds.clientId ?? null;
    }
    if (platform === Marketplace.ALIBABA_TR) {
      return creds.appKey ?? creds.clientId ?? null;
    }
    if (platform === Marketplace.TRENDYOL_MILLA) {
      return creds.sellerId ?? null;
    }
    if (platform === Marketplace.G2A) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (
      platform === Marketplace.KINGUIN ||
      platform === Marketplace.DLGAMER ||
      platform === Marketplace.TRADESY ||
      platform === Marketplace.GYMSHARK ||
      platform === Marketplace.DECATHLON_TR ||
      platform === Marketplace.INTERSPORT_TR ||
      platform === Marketplace.SPORTIVE_TR ||
      platform === Marketplace.ENEBA
    ) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
    }
    if (
      platform === Marketplace.GAMEFLIP ||
      platform === Marketplace.MERCARI
    ) {
      return creds.accessToken
        ? `${creds.accessToken.slice(0, 6)}...`
        : creds.clientId ?? null;
    }
    if (platform === Marketplace.STOCKX) {
      return creds.apiKey ? `${creds.apiKey.slice(0, 6)}...` : null;
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

  /** Yalnızca aktif ve silinmemiş pazaryeri bağlantıları */
  async getActiveConnections(
    organizationId: string,
  ): Promise<PublicMarketplaceConnection[]> {
    const rows = await this.prisma.marketplaceConnection.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
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

    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });
    if (!subscription) {
      throw new HttpException(
        'Aktif abonelik bulunamadı',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    const marketplaceLimit =
      this.subscriptionService.effectiveMarketplaceLimit(subscription);
    const activeCount = await this.prisma.marketplaceConnection.count({
      where: { organizationId, deletedAt: null, isActive: true },
    });
    const willConsumeSlot = !existing || existing.deletedAt !== null;
    if (willConsumeSlot && activeCount >= marketplaceLimit) {
      throw new HttpException(
        'Paketinizin pazaryeri bağlantı limitine ulaştınız. Paketi yükseltin.',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const credentialsEnc = this.encryptionService.encrypt(
      JSON.stringify(dto.credentials),
    );
    const isFirst = activeCount === 0;

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
      this.posthog.groupCapture(organizationId, 'marketplace_connected', {
        platform: dto.platform,
        isFirst,
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
    this.posthog.groupCapture(organizationId, 'marketplace_connected', {
      platform: dto.platform,
      isFirst,
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

  /**
   * İş kuyruğu: belirli bağlantı kimliği için şifreli kimlik bilgisini çözer.
   */
  async getDecryptedCredentialsForConnection(
    organizationId: string,
    connectionId: string,
  ): Promise<Record<string, string> | null> {
    const row = await this.prisma.marketplaceConnection.findFirst({
      where: {
        id: connectionId,
        organizationId,
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
