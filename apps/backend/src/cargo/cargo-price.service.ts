import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CargoConnection, CargoProvider } from '@prisma/client';

import { createCargoAdapter } from '../adapters/cargo/cargo-adapter.factory';
import type { CargoRate, RateParams } from '../adapters/cargo-adapter.interface';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';

export interface PriceParams {
  weight: number;
  desi?: number;
  fromCity: string;
  toCity: string;
}

export interface CargoPrice {
  provider: CargoProvider;
  connectionId: string;
  providerLabel: string;
  price: number;
  currency: string;
  serviceName: string;
  estimatedTransitDays?: number;
}

const CARGO_PROVIDER_LABEL_TR: Record<string, string> = {
  YURTICI: 'Yurtiçi Kargo',
  ARAS: 'Aras Kargo',
  MNG: 'MNG Kargo',
  SURAT: 'Sürat Kargo',
  PTT: 'PTT Kargo',
  PTT_KARGO: 'PTT Kargo',
  UPS: 'UPS',
  DHL: 'DHL Express',
  DHL_PARCEL: 'DHL Parcel',
  FEDEX: 'FedEx',
  SENDEO: 'Sendeo',
  HEPSIJET: 'Hepsijet',
  TRENDYOL_EXPRESS: 'Trendyol Express',
  NETLOG: 'Netlog Lojistik',
  HOROZ: 'Horoz Lojistik',
  TNT: 'TNT Express',
  GLS: 'GLS',
  DPD: 'DPD',
  HERMES: 'Hermes',
  POSTNL: 'PostNL',
  BRINGO: 'Bringo',
  CEVA: 'CEVA Lojistik',
  NART_KARGO: 'Nart Kargo',
  KOLAY_GELSIN: 'Kolay Gelsin',
};

@Injectable()
export class CargoPriceService {
  private readonly logger = new Logger(CargoPriceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async calculatePrice(
    provider: CargoProvider,
    orgId: string,
    params: PriceParams,
  ): Promise<CargoPrice | null> {
    const connections = await this.prisma.cargoConnection.findMany({
      where: { organizationId: orgId, provider, isActive: true },
    });
    if (connections.length === 0) {
      return null;
    }

    const rateParams = buildRateParams(params);
    const settled = await Promise.allSettled(
      connections.map((conn) => this.fetchConnectionPrice(conn, rateParams)),
    );

    const prices = settled
      .filter((s): s is PromiseFulfilledResult<CargoPrice> => s.status === 'fulfilled')
      .map((s) => s.value)
      .filter((p): p is CargoPrice => p !== null);

    if (prices.length === 0) {
      return null;
    }
    return prices.reduce((a, b) => (a.price <= b.price ? a : b));
  }

  async compareAllPrices(orgId: string, params: PriceParams): Promise<CargoPrice[]> {
    const connections = await this.getActiveCargoConnections(orgId);
    if (connections.length === 0) {
      throw new NotFoundException('Aktif kargo bağlantısı bulunamadı');
    }

    const rateParams = buildRateParams(params);
    const settled = await Promise.allSettled(
      connections.map((conn) => this.fetchConnectionPrice(conn, rateParams)),
    );

    const rows: CargoPrice[] = [];
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) {
        rows.push(s.value);
      }
    }
    return rows.sort((a, b) => a.price - b.price);
  }

  private async getActiveCargoConnections(organizationId: string): Promise<CargoConnection[]> {
    return this.prisma.cargoConnection.findMany({
      where: { organizationId, isActive: true },
    });
  }

  private async fetchConnectionPrice(
    conn: CargoConnection,
    params: RateParams,
  ): Promise<CargoPrice | null> {
    try {
      const creds = this.parseCredentials(conn.credentialsEnc);
      if (Object.keys(creds).length === 0) {
        return null;
      }
      const adapter = createCargoAdapter(conn.provider, creds);
      const rates = await adapter.getRates(params);
      if (rates.length === 0) {
        return null;
      }
      const best = pickCheapestRate(rates);
      return {
        provider: conn.provider,
        connectionId: conn.id,
        providerLabel:
          CARGO_PROVIDER_LABEL_TR[String(conn.provider)] ?? String(conn.provider),
        price: best.price,
        currency: best.currency,
        serviceName: best.serviceName,
        estimatedTransitDays: best.transitDaysMin ?? best.transitDaysMax,
      };
    } catch (error) {
      this.logger.warn('Kargo fiyatı alınamadı', {
        provider: conn.provider,
        message: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  private parseCredentials(enc: string | null): Record<string, unknown> {
    if (!enc) {
      return {};
    }
    try {
      const plain = this.encryption.decrypt(enc);
      const parsed: unknown = JSON.parse(plain);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
}

function pickCheapestRate(rates: CargoRate[]): CargoRate {
  return rates.reduce((a, b) => (a.price <= b.price ? a : b));
}

function buildRateParams(params: PriceParams): RateParams {
  return {
    fromCountryCode: 'TR',
    toCountryCode: 'TR',
    fromPostalCode: '34000',
    toPostalCode: '34000',
    fromCity: params.fromCity,
    toCity: params.toCity,
    weightKg: Math.max(0.1, params.weight),
    desi: params.desi,
  };
}
