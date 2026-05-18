import { Injectable } from '@nestjs/common';
import { Marketplace, type MarketplaceConnection } from '@prisma/client';

import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';

function readTrimmedString(
  obj: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = obj[key];
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : undefined;
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    return String(v).trim();
  }
  return undefined;
}

function supplierKeyFromBody(
  body: unknown,
  keys: readonly string[],
): string | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return undefined;
  }
  const rec = body as Record<string, unknown>;
  for (const k of keys) {
    const v = readTrimmedString(rec, k);
    if (v) {
      return v;
    }
  }
  const nested = rec.data ?? rec.payload ?? rec.order ?? rec.merchant;
  if (
    typeof nested === 'object' &&
    nested !== null &&
    !Array.isArray(nested)
  ) {
    const n = nested as Record<string, unknown>;
    for (const k of keys) {
      const v = readTrimmedString(n, k);
      if (v) {
        return v;
      }
    }
  }
  return undefined;
}

function header(
  headers: Record<string, string>,
  name: string,
): string | undefined {
  const lower = name.toLowerCase();
  const direct = headers[name];
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower && typeof v === 'string' && v.trim()) {
      return v.trim();
    }
  }
  return undefined;
}

@Injectable()
export class WebhookConnectionResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  private decryptCredentialsJson(credentialsEnc: string): Record<string, unknown> {
    try {
      const json = this.encryptionService.decrypt(credentialsEnc);
      const parsed: unknown = JSON.parse(json);
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        return {};
      }
      return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private normalizeHost(urlOrHost: string): string {
    const t = urlOrHost.trim().toLowerCase();
    try {
      if (t.startsWith('http://') || t.startsWith('https://')) {
        return new URL(t).hostname;
      }
    } catch {
      /* ignore */
    }
    return t.replace(/^https?:\/\//, '').split('/')[0] ?? t;
  }

  private credMatches(
    creds: Record<string, unknown>,
    supplierKey: string,
    keys: readonly string[],
    domainLoose?: boolean,
  ): boolean {
    const want = domainLoose ? this.normalizeHost(supplierKey) : supplierKey;
    for (const k of keys) {
      const v = readTrimmedString(creds, k);
      if (!v) {
        continue;
      }
      if (domainLoose) {
        if (this.normalizeHost(v) === want) {
          return true;
        }
      } else if (v === supplierKey) {
        return true;
      }
    }
    return false;
  }

  /**
   * Pazaryeri + supplierId (gövde/başlık) veya connectionId ipucu ile bağlantı bulur.
   */
  async resolve(
    platform: Marketplace,
    body: unknown,
    headers: Record<string, string>,
    connectionIdHint?: string,
  ): Promise<MarketplaceConnection | null> {
    if (connectionIdHint?.trim()) {
      const row = await this.prisma.marketplaceConnection.findFirst({
        where: {
          id: connectionIdHint.trim(),
          platform,
          deletedAt: null,
          isActive: true,
        },
      });
      return row ?? null;
    }

    const rows = await this.prisma.marketplaceConnection.findMany({
      where: { platform, deletedAt: null, isActive: true },
    });
    if (rows.length === 0) {
      return null;
    }
    if (rows.length === 1) {
      return rows[0];
    }

    let supplierKey: string | undefined;
    let credKeys: readonly string[] = [];

    switch (platform) {
      case Marketplace.TRENDYOL:
        supplierKey =
          supplierKeyFromBody(body, [
            'supplierId',
            'sellerId',
            'merchantId',
            'partnerId',
          ]) ?? header(headers, 'x-supplierid');
        credKeys = ['sellerId', 'supplierId', 'merchantId'];
        break;
      case Marketplace.HEPSIBURADA:
        supplierKey =
          supplierKeyFromBody(body, [
            'merchantId',
            'MerchantId',
            'sellerId',
            'storeId',
          ]) ?? header(headers, 'x-merchant-id');
        credKeys = ['merchantId', 'sellerId', 'storeId', 'merchantSku'];
        break;
      case Marketplace.N11:
        supplierKey =
          supplierKeyFromBody(body, ['sellerId', 'merchantId', 'appKey']) ??
          header(headers, 'x-n11-seller-id');
        credKeys = ['apiKey', 'appKey', 'sellerId', 'merchantId'];
        break;
      case Marketplace.SHOPIFY:
        supplierKey =
          header(headers, 'x-shopify-shop-domain') ??
          supplierKeyFromBody(body, ['shopDomain', 'shop', 'domain']);
        credKeys = ['shopDomain', 'shop', 'domain'];
        break;
      case Marketplace.WOOCOMMERCE:
        supplierKey =
          supplierKeyFromBody(body, ['siteUrl', 'storeUrl', 'domain']) ??
          header(headers, 'x-wc-webhook-source');
        credKeys = ['siteUrl', 'storeUrl', 'url', 'domain', 'consumerKey'];
        break;
      case Marketplace.AMAZON_TR:
        supplierKey = this.extractAmazonTopicArn(body);
        credKeys = ['sellerId', 'marketplaceId', 'topicArn', 'mwsSellerId'];
        break;
      default:
        supplierKey = supplierKeyFromBody(body, [
          'supplierId',
          'sellerId',
          'merchantId',
        ]);
        credKeys = ['sellerId', 'supplierId', 'merchantId', 'storeId'];
    }

    if (!supplierKey) {
      return null;
    }

    const domainLoose =
      platform === Marketplace.SHOPIFY || platform === Marketplace.WOOCOMMERCE;

    const matched = rows.filter((row) =>
      this.credMatches(
        this.decryptCredentialsJson(row.credentialsEnc),
        supplierKey,
        credKeys.length > 0
          ? credKeys
          : ['sellerId', 'supplierId', 'merchantId'],
        domainLoose,
      ),
    );
    if (matched.length === 1) {
      return matched[0];
    }

    if (platform === Marketplace.AMAZON_TR && supplierKey) {
      const byTopic = rows.filter((row) => {
        const creds = this.decryptCredentialsJson(row.credentialsEnc);
        const topic = readTrimmedString(creds, 'topicArn');
        const secret = row.webhookSecret ?? '';
        return (
          (topic && supplierKey.includes(topic)) ||
          (secret.length > 0 && supplierKey.includes(secret))
        );
      });
      if (byTopic.length === 1) {
        return byTopic[0];
      }
    }

    return null;
  }

  private extractAmazonTopicArn(body: unknown): string | undefined {
    if (typeof body !== 'object' || body === null) {
      return undefined;
    }
    const rec = body as Record<string, unknown>;
    const arn =
      readTrimmedString(rec, 'TopicArn') ??
      readTrimmedString(rec, 'topicArn');
    return arn;
  }
}
