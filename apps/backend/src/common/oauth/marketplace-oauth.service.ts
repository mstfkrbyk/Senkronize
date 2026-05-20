import { Injectable, Logger } from '@nestjs/common';
import { Marketplace } from '@prisma/client';

import {
  LAZADA_ACCESS_TOKEN_TTL_SEC,
  LAZADA_REFRESH_TOKEN_TTL_SEC,
} from '../../adapters/lazada/lazada.constants';
import {
  buildLazadaAuthorizeUrl,
  exchangeLazadaAuthorizationCode,
  refreshLazadaAccessToken,
  type LazadaOAuthTokens,
} from '../../adapters/lazada/lazada.oauth';
import {
  buildMercadolibreAuthorizeUrl,
  exchangeMercadolibreAuthorizationCode,
  refreshMercadolibreAccessToken,
  type MercadolibreOAuthTokens,
} from '../../adapters/mercadolibre/mercadolibre.oauth';
import { MERCADOLIBRE_ACCESS_TOKEN_TTL_SEC } from '../../adapters/mercadolibre/mercadolibre.constants';
import {
  SHOPEE_ACCESS_TOKEN_TTL_SEC,
  SHOPEE_REFRESH_TOKEN_TTL_SEC,
} from '../../adapters/shopee/shopee.constants';
import {
  buildShopeeAuthorizeUrl,
  exchangeShopeeAuthorizationCode,
  refreshShopeeAccessToken,
  type ShopeeOAuthTokens,
} from '../../adapters/shopee/shopee.oauth';
import {
  MarketplaceTokenCache,
  marketplaceTokenCacheKey,
} from '../../adapters/common/marketplace-token-cache';

export type MarketplaceOAuthTokens =
  | LazadaOAuthTokens
  | ShopeeOAuthTokens
  | MercadolibreOAuthTokens;

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

@Injectable()
export class MarketplaceOAuthService {
  private readonly logger = new Logger(MarketplaceOAuthService.name);

  constructor(private readonly tokenCache: MarketplaceTokenCache) {}

  buildAuthorizeUrl(
    platform: Marketplace,
    state: string,
    redirectUri: string,
    credentials: Record<string, string>,
  ): string {
    if (platform === Marketplace.LAZADA) {
      const appKey = credentials.appKey?.trim() ?? credentials.apiKey?.trim() ?? '';
      if (!appKey) {
        throw new Error('Lazada: appKey zorunludur');
      }
      return buildLazadaAuthorizeUrl(appKey, redirectUri, state);
    }
    if (platform === Marketplace.SHOPEE) {
      const partnerId = credentials.partnerId?.trim() ?? '';
      const partnerKey =
        credentials.partnerKey?.trim() ??
        credentials.apiSecret?.trim() ??
        credentials.secretKey?.trim() ??
        '';
      if (!partnerId || !partnerKey) {
        throw new Error('Shopee: partnerId ve partnerKey zorunludur');
      }
      return buildShopeeAuthorizeUrl(partnerId, partnerKey, redirectUri);
    }
    if (platform === Marketplace.MERCADOLIBRE) {
      const clientId = credentials.clientId?.trim() ?? '';
      if (!clientId) {
        throw new Error('MercadoLibre: clientId zorunludur');
      }
      return buildMercadolibreAuthorizeUrl(clientId, redirectUri, state);
    }
    throw new Error(`OAuth yetkilendirme URL desteklenmiyor: ${platform}`);
  }

  buildWebhookCallbackUrl(
    appBaseUrl: string,
    platform: Marketplace,
    connectionId: string,
  ): string {
    const base = appBaseUrl.replace(/\/$/, '');
    return `${base}/api/v1/webhooks/${platform.toLowerCase()}/${connectionId}`;
  }

  async exchangeAuthorizationCode(
    platform: Marketplace,
    credentials: Record<string, string>,
    code: string,
    connectionId: string,
    redirectUri?: string,
  ): Promise<Record<string, string>> {
    const tokens =
      platform === Marketplace.LAZADA
        ? await this.exchangeLazada(credentials, code)
        : platform === Marketplace.SHOPEE
          ? await this.exchangeShopee(credentials, code)
          : platform === Marketplace.MERCADOLIBRE
            ? await this.exchangeMercadolibre(
                credentials,
                code,
                redirectUri ?? '',
              )
            : null;
    if (!tokens) {
      throw new Error(`OAuth kod değişimi desteklenmiyor: ${platform}`);
    }
    await this.cacheTokens(platform, connectionId, tokens);
    return this.tokensToCredentialPatch(tokens);
  }

  async refreshAndCacheTokens(
    platform: Marketplace,
    connectionId: string,
    credentials: Record<string, string>,
  ): Promise<Record<string, string>> {
    if (!this.shouldRefresh(credentials)) {
      return credentials;
    }
    const tokens =
      platform === Marketplace.LAZADA
        ? await this.refreshLazada(credentials)
        : platform === Marketplace.SHOPEE
          ? await this.refreshShopee(credentials)
          : platform === Marketplace.MERCADOLIBRE
            ? await this.refreshMercadolibre(credentials)
            : null;
    if (!tokens) {
      return credentials;
    }
    await this.cacheTokens(platform, connectionId, tokens);
    return { ...credentials, ...this.tokensToCredentialPatch(tokens) };
  }

  async getCachedAccessToken(
    platform: Marketplace,
    connectionId: string,
  ): Promise<string | null> {
    const key = marketplaceTokenCacheKey(
      platform,
      `${connectionId}:access`,
    );
    return this.tokenCache.get(key);
  }

  private shouldRefresh(credentials: Record<string, string>): boolean {
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
    return false;
  }

  private async exchangeLazada(
    credentials: Record<string, string>,
    code: string,
  ): Promise<LazadaOAuthTokens> {
    const appKey = credentials.appKey?.trim() ?? credentials.apiKey?.trim() ?? '';
    const appSecret =
      credentials.appSecret?.trim() ??
      credentials.apiSecret?.trim() ??
      credentials.secretKey?.trim() ??
      '';
    if (!appKey || !appSecret) {
      throw new Error('Lazada: appKey ve appSecret zorunludur');
    }
    return exchangeLazadaAuthorizationCode(appKey, appSecret, code);
  }

  private async exchangeShopee(
    credentials: Record<string, string>,
    code: string,
  ): Promise<ShopeeOAuthTokens> {
    const partnerId = credentials.partnerId?.trim() ?? '';
    const partnerKey =
      credentials.partnerKey?.trim() ??
      credentials.apiSecret?.trim() ??
      credentials.secretKey?.trim() ??
      '';
    const shopId = credentials.shopId?.trim() ?? '';
    if (!partnerId || !partnerKey || !shopId) {
      throw new Error('Shopee: partnerId, partnerKey ve shopId zorunludur');
    }
    return exchangeShopeeAuthorizationCode(partnerId, partnerKey, code, shopId);
  }

  private async refreshLazada(
    credentials: Record<string, string>,
  ): Promise<LazadaOAuthTokens> {
    const appKey = credentials.appKey?.trim() ?? credentials.apiKey?.trim() ?? '';
    const appSecret =
      credentials.appSecret?.trim() ??
      credentials.apiSecret?.trim() ??
      credentials.secretKey?.trim() ??
      '';
    const refreshToken = credentials.refreshToken?.trim() ?? '';
    if (!appKey || !appSecret || !refreshToken) {
      throw new Error('Lazada: appKey, appSecret ve refreshToken zorunludur');
    }
    return refreshLazadaAccessToken(appKey, appSecret, refreshToken);
  }

  private async refreshShopee(
    credentials: Record<string, string>,
  ): Promise<ShopeeOAuthTokens> {
    const partnerId = credentials.partnerId?.trim() ?? '';
    const partnerKey =
      credentials.partnerKey?.trim() ??
      credentials.apiSecret?.trim() ??
      credentials.secretKey?.trim() ??
      '';
    const refreshToken = credentials.refreshToken?.trim() ?? '';
    const shopId = credentials.shopId?.trim() ?? '';
    if (!partnerId || !partnerKey || !refreshToken || !shopId) {
      throw new Error('Shopee: partnerId, partnerKey, refreshToken ve shopId zorunludur');
    }
    return refreshShopeeAccessToken(partnerId, partnerKey, refreshToken, shopId);
  }

  private async cacheTokens(
    platform: Marketplace,
    connectionId: string,
    tokens: MarketplaceOAuthTokens,
  ): Promise<void> {
    const accessTtl =
      platform === Marketplace.LAZADA
        ? LAZADA_ACCESS_TOKEN_TTL_SEC
        : platform === Marketplace.MERCADOLIBRE
          ? MERCADOLIBRE_ACCESS_TOKEN_TTL_SEC
          : SHOPEE_ACCESS_TOKEN_TTL_SEC;
    const refreshTtl =
      platform === Marketplace.LAZADA
        ? LAZADA_REFRESH_TOKEN_TTL_SEC
        : platform === Marketplace.MERCADOLIBRE
          ? MERCADOLIBRE_ACCESS_TOKEN_TTL_SEC * 4
          : SHOPEE_REFRESH_TOKEN_TTL_SEC;
    const accessKey = marketplaceTokenCacheKey(platform, `${connectionId}:access`);
    const refreshKey = marketplaceTokenCacheKey(platform, `${connectionId}:refresh`);
    await this.tokenCache.set(accessKey, tokens.accessToken, accessTtl);
    await this.tokenCache.set(refreshKey, tokens.refreshToken, refreshTtl);
    this.logger.debug('Pazaryeri OAuth token önbelleğe yazıldı', {
      platform,
      connectionId,
    });
  }

  private async exchangeMercadolibre(
    credentials: Record<string, string>,
    code: string,
    redirectUri: string,
  ): Promise<MercadolibreOAuthTokens> {
    const clientId = credentials.clientId?.trim() ?? '';
    const clientSecret = credentials.clientSecret?.trim() ?? '';
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error(
        'MercadoLibre: clientId, clientSecret ve redirectUri zorunludur',
      );
    }
    return exchangeMercadolibreAuthorizationCode(
      clientId,
      clientSecret,
      code,
      redirectUri,
    );
  }

  private async refreshMercadolibre(
    credentials: Record<string, string>,
  ): Promise<MercadolibreOAuthTokens> {
    const clientId = credentials.clientId?.trim() ?? '';
    const clientSecret = credentials.clientSecret?.trim() ?? '';
    const refreshToken = credentials.refreshToken?.trim() ?? '';
    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('MercadoLibre: clientId, clientSecret ve refreshToken zorunludur');
    }
    return refreshMercadolibreAccessToken(clientId, clientSecret, refreshToken);
  }

  private tokensToCredentialPatch(tokens: MarketplaceOAuthTokens): Record<string, string> {
    const patch: Record<string, string> = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: String(tokens.tokenExpiresAt),
    };
    if ('userId' in tokens && typeof tokens.userId === 'string' && tokens.userId.length > 0) {
      patch.sellerId = tokens.userId;
      patch.userId = tokens.userId;
    }
    return patch;
  }
}
