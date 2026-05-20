import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Marketplace } from '@prisma/client';

import { exchangeMercadolibreAuthorizationCode } from '../adapters/mercadolibre/mercadolibre.oauth';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';

export interface MarketplaceOAuthStatePayload {
  connectionId: string;
  organizationId: string;
  platform: Marketplace;
  redirectUri: string;
}

@Injectable()
export class OAuthCallbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  buildMercadolibreCallbackUrl(): string {
    const base = (this.config.get<string>('APP_URL') ?? 'http://localhost:3001').replace(
      /\/$/,
      '',
    );
    return `${base}/api/v1/oauth/callback/mercadolibre`;
  }

  signOAuthState(payload: Omit<MarketplaceOAuthStatePayload, 'platform'> & {
    platform: Marketplace;
  }): string {
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

  async completeMercadolibreCallback(
    code: string,
    state: string,
  ): Promise<{ connectionId: string; organizationId: string }> {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      throw new BadRequestException('OAuth code zorunludur');
    }

    const statePayload = this.verifyOAuthState(state);
    if (statePayload.platform !== Marketplace.MERCADOLIBRE) {
      throw new BadRequestException('Platform uyuşmazlığı');
    }

    const row = await this.prisma.marketplaceConnection.findFirst({
      where: {
        id: statePayload.connectionId,
        organizationId: statePayload.organizationId,
        platform: Marketplace.MERCADOLIBRE,
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

    const clientId = creds.clientId?.trim() ?? '';
    const clientSecret = creds.clientSecret?.trim() ?? '';
    if (!clientId || !clientSecret) {
      throw new BadRequestException('MercadoLibre: clientId ve clientSecret zorunludur');
    }

    const tokens = await exchangeMercadolibreAuthorizationCode(
      clientId,
      clientSecret,
      trimmedCode,
      statePayload.redirectUri,
    );

    const merged: Record<string, string> = {
      ...creds,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: String(tokens.tokenExpiresAt),
    };
    if (tokens.userId) {
      merged.sellerId = tokens.userId;
      merged.userId = tokens.userId;
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

  panelRedirectUrl(success: boolean, connectionId?: string): string {
    const panelBase = (this.config.get<string>('PANEL_URL') ?? 'http://localhost:5173').replace(
      /\/$/,
      '',
    );
    const params = new URLSearchParams({
      oauth: success ? 'success' : 'error',
      platform: 'mercadolibre',
    });
    if (connectionId) {
      params.set('connectionId', connectionId);
    }
    return `${panelBase}/connections?${params.toString()}`;
  }
}
