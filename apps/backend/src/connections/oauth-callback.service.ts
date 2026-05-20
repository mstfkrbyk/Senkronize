import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Marketplace } from '@prisma/client';

import { EncryptionService } from '../common/encryption/encryption.service';
import { MarketplaceOAuthService } from '../common/oauth/marketplace-oauth.service';
import { PrismaService } from '../prisma/prisma.service';

export interface MarketplaceOAuthStatePayload {
  connectionId: string;
  organizationId: string;
  platform: Marketplace;
  redirectUri: string;
}

const OAUTH_CALLBACK_PLATFORMS: Marketplace[] = [
  Marketplace.LAZADA,
  Marketplace.SHOPEE,
  Marketplace.MERCADOLIBRE,
];

function oauthCallbackSlug(platform: Marketplace): string {
  if (platform === Marketplace.MERCADOLIBRE) {
    return 'mercadolibre';
  }
  if (platform === Marketplace.LAZADA) {
    return 'lazada';
  }
  if (platform === Marketplace.SHOPEE) {
    return 'shopee';
  }
  return platform.toLowerCase();
}

@Injectable()
export class OAuthCallbackService {
  private readonly logger = new Logger(OAuthCallbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly marketplaceOAuth: MarketplaceOAuthService,
  ) {}

  buildCallbackUrl(platform: Marketplace): string {
    if (!OAUTH_CALLBACK_PLATFORMS.includes(platform)) {
      throw new BadRequestException(`OAuth callback desteklenmiyor: ${platform}`);
    }
    const base = (this.config.get<string>('APP_URL') ?? 'http://localhost:3001').replace(
      /\/$/,
      '',
    );
    return `${base}/api/v1/oauth/callback/${oauthCallbackSlug(platform)}`;
  }

  buildMercadolibreCallbackUrl(): string {
    return this.buildCallbackUrl(Marketplace.MERCADOLIBRE);
  }

  signOAuthState(
    payload: Omit<MarketplaceOAuthStatePayload, 'platform'> & {
      platform: Marketplace;
    },
  ): string {
    return this.jwtService.sign(
      { ...payload, purpose: 'marketplace-oauth' },
      { expiresIn: '15m' },
    );
  }

  verifyOAuthState(state: string): MarketplaceOAuthStatePayload {
    try {
      const decoded = this.jwtService.verify<{
        connectionId?: string;
        organizationId?: string;
        platform?: Marketplace;
        redirectUri?: string;
        purpose?: string;
      }>(state);
      if (decoded.purpose !== 'marketplace-oauth') {
        throw new Error('Geçersiz state');
      }
      const connectionId = decoded.connectionId?.trim() ?? '';
      const organizationId = decoded.organizationId?.trim() ?? '';
      const platform = decoded.platform;
      const redirectUri = decoded.redirectUri?.trim() ?? '';
      if (!connectionId || !organizationId || !platform || !redirectUri) {
        throw new Error('Eksik state alanları');
      }
      return { connectionId, organizationId, platform, redirectUri };
    } catch {
      throw new BadRequestException('Geçersiz veya süresi dolmuş OAuth state');
    }
  }

  private parseCredentialsRecord(credentialsEnc: string): Record<string, string> | null {
    try {
      const json = this.encryptionService.decrypt(credentialsEnc);
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

  async completeOAuthCallback(
    expectedPlatform: Marketplace,
    code: string,
    state: string,
    options?: { shopId?: string },
  ): Promise<{ connectionId: string; organizationId: string }> {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      throw new BadRequestException('OAuth code zorunludur');
    }

    const statePayload = this.verifyOAuthState(state);
    if (statePayload.platform !== expectedPlatform) {
      throw new BadRequestException('Platform uyuşmazlığı');
    }

    const row = await this.prisma.marketplaceConnection.findFirst({
      where: {
        id: statePayload.connectionId,
        organizationId: statePayload.organizationId,
        platform: expectedPlatform,
        deletedAt: null,
      },
    });
    if (!row) {
      throw new NotFoundException('Pazaryeri bağlantısı bulunamadı');
    }

    const creds = this.parseCredentialsRecord(row.credentialsEnc);
    if (!creds) {
      throw new BadRequestException('Bağlantı kimlik bilgileri okunamadı');
    }

    const credsForExchange = { ...creds };
    if (expectedPlatform === Marketplace.SHOPEE) {
      const shopId = options?.shopId?.trim() ?? creds.shopId?.trim() ?? '';
      if (!shopId) {
        throw new BadRequestException('Shopee: shop_id zorunludur');
      }
      credsForExchange.shopId = shopId;
    }

    const tokenPatch = await this.marketplaceOAuth.exchangeAuthorizationCode(
      expectedPlatform,
      credsForExchange,
      trimmedCode,
      row.id,
      expectedPlatform === Marketplace.MERCADOLIBRE
        ? statePayload.redirectUri
        : undefined,
    );

    const merged: Record<string, string> = { ...creds, ...tokenPatch };
    if (expectedPlatform === Marketplace.SHOPEE && credsForExchange.shopId) {
      merged.shopId = credsForExchange.shopId;
    }

    const credentialsEnc = this.encryptionService.encrypt(JSON.stringify(merged));
    await this.prisma.marketplaceConnection.update({
      where: { id: row.id },
      data: { credentialsEnc, isActive: true },
    });

    return {
      connectionId: row.id,
      organizationId: statePayload.organizationId,
    };
  }

  async completeMercadolibreCallback(
    code: string,
    state: string,
  ): Promise<{ connectionId: string; organizationId: string }> {
    return this.completeOAuthCallback(Marketplace.MERCADOLIBRE, code, state);
  }

  async completeLazadaCallback(
    code: string,
    state: string,
  ): Promise<{ connectionId: string; organizationId: string }> {
    return this.completeOAuthCallback(Marketplace.LAZADA, code, state);
  }

  async completeShopeeCallback(
    code: string,
    state: string,
    shopId: string,
  ): Promise<{ connectionId: string; organizationId: string }> {
    return this.completeOAuthCallback(Marketplace.SHOPEE, code, state, { shopId });
  }

  panelRedirectUrl(
    success: boolean,
    platform: Marketplace,
    connectionId?: string,
  ): string {
    const panelBase = (this.config.get<string>('PANEL_URL') ?? 'http://localhost:5173').replace(
      /\/$/,
      '',
    );
    const params = new URLSearchParams({
      oauth: success ? 'success' : 'error',
      platform: oauthCallbackSlug(platform),
    });
    if (connectionId) {
      params.set('connectionId', connectionId);
    }
    return `${panelBase}/connections?${params.toString()}`;
  }

  logCallbackFailure(platform: Marketplace, reason: string): void {
    this.logger.warn('OAuth callback başarısız', {
      platform: oauthCallbackSlug(platform),
      reason,
    });
  }
}
