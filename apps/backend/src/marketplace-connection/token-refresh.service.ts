import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Marketplace } from '@prisma/client';

import { refreshIdeasoftAccessToken } from '../adapters/ecommerce/ideasoft/ideasoft.oauth';
import { refreshEtsyAccessToken } from '../adapters/etsy/etsy.oauth';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';

const REFRESH_BUFFER_MS = 5 * 60 * 1000;
const OAUTH_PLATFORMS: Marketplace[] = [
  Marketplace.ETSY,
  Marketplace.GITTIGIDIYOR,
  Marketplace.IDEASOFT,
];

function parseCredentialsRecord(
  encryptionService: EncryptionService,
  credentialsEnc: string,
): Record<string, string> | null {
  try {
    const json = encryptionService.decrypt(credentialsEnc);
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
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

function shouldRefreshToken(credentials: Record<string, string>): boolean {
  const expiresRaw = credentials.tokenExpiresAt?.trim();
  if (expiresRaw) {
    const expiresAt = Number.parseInt(expiresRaw, 10);
    if (!Number.isFinite(expiresAt)) {
      return true;
    }
    return Date.now() >= expiresAt - REFRESH_BUFFER_MS;
  }
  const refreshToken = credentials.refreshToken?.trim();
  if (refreshToken) {
    const access = credentials.accessToken?.trim();
    return !access || access.length === 0;
  }
  const access = credentials.accessToken?.trim();
  return !access || access.length === 0;
}

function tokensToCredentialPatch(tokens: {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
}): Record<string, string> {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tokenExpiresAt: String(tokens.tokenExpiresAt),
  };
}

@Injectable()
export class TokenRefreshService {
  private readonly logger = new Logger(TokenRefreshService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /** Süresi dolmak üzere olan tokenları yeniler; güncel kimlik bilgisini döner. */
  async ensureFreshCredentials(
    organizationId: string,
    platform: Marketplace,
    credentials: Record<string, string>,
    connectionId?: string,
  ): Promise<Record<string, string>> {
    if (!OAUTH_PLATFORMS.includes(platform)) {
      return credentials;
    }
    if (!shouldRefreshToken(credentials)) {
      return credentials;
    }
    const refreshed = await this.refreshPlatformTokens(platform, credentials);
    if (connectionId) {
      await this.persistCredentials(connectionId, organizationId, credentials, refreshed);
    }
    return refreshed;
  }

  /** Aktif OAuth bağlantılarının tokenlarını periyodik yeniler. */
  @Cron('*/10 * * * *')
  async refreshExpiringTokens(): Promise<void> {
    const connections = await this.prisma.marketplaceConnection.findMany({
      where: {
        platform: { in: OAUTH_PLATFORMS },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        organizationId: true,
        platform: true,
        credentialsEnc: true,
      },
    });

    let refreshed = 0;
    for (const conn of connections) {
      const creds = parseCredentialsRecord(this.encryptionService, conn.credentialsEnc);
      if (!creds || !shouldRefreshToken(creds)) {
        continue;
      }
      try {
        const updated = await this.refreshPlatformTokens(conn.platform, creds);
        await this.persistCredentials(conn.id, conn.organizationId, creds, updated);
        refreshed += 1;
      } catch (error) {
        this.logger.warn('Pazaryeri token yenileme başarısız', {
          connectionId: conn.id,
          platform: conn.platform,
          error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        });
      }
    }

    if (refreshed > 0) {
      this.logger.log(`Pazaryeri token yenilendi: ${String(refreshed)} bağlantı`);
    }
  }

  private async refreshPlatformTokens(
    platform: Marketplace,
    credentials: Record<string, string>,
  ): Promise<Record<string, string>> {
    if (platform === Marketplace.ETSY) {
      return this.refreshEtsy(credentials);
    }
    if (platform === Marketplace.IDEASOFT) {
      return refreshIdeasoftAccessToken(credentials);
    }
    return credentials;
  }

  private async refreshEtsy(
    credentials: Record<string, string>,
  ): Promise<Record<string, string>> {
    const clientId = credentials.apiKey?.trim() ?? '';
    const clientSecret = credentials.apiSecret?.trim() ?? '';
    const refreshToken = credentials.refreshToken?.trim() ?? '';
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Etsy: apiKey, apiSecret ve refreshToken zorunludur');
    }
    const tokens = await refreshEtsyAccessToken(clientId, clientSecret, refreshToken);
    return {
      ...credentials,
      ...tokensToCredentialPatch(tokens),
    };
  }

  private async persistCredentials(
    connectionId: string,
    organizationId: string,
    current: Record<string, string>,
    updated: Record<string, string>,
  ): Promise<void> {
    const merged: Record<string, string> = { ...current, ...updated };
    const credentialsEnc = this.encryptionService.encrypt(JSON.stringify(merged));
    await this.prisma.marketplaceConnection.updateMany({
      where: { id: connectionId, organizationId, deletedAt: null },
      data: { credentialsEnc },
    });
  }
}
