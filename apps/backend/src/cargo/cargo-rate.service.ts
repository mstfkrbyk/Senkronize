import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CargoConnection } from '@prisma/client';

import { createCargoAdapter } from '../adapters/cargo/cargo-adapter.factory';
import type {
  CargoRate,
  CargoRateComparison,
  RateParams,
} from '../adapters/cargo-adapter.interface';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';

const CARGO_PROVIDER_LABEL_TR: Record<string, string> = {
  YURTICI: 'Yurtiçi Kargo',
  ARAS: 'Aras Kargo',
  MNG: 'MNG Kargo',
  SURAT: 'Sürat Kargo',
  PTT: 'PTT Kargo',
  PTT_KARGO: 'PTT Kargo',
  UPS: 'UPS',
  DHL: 'DHL Express',
  FEDEX: 'FedEx',
  SENDEO: 'Sendeo',
  HEPSIJET: 'Hepsijet',
  TRENDYOL_EXPRESS: 'Trendyol Express',
};

@Injectable()
export class CargoRateService {
  private readonly logger = new Logger(CargoRateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async compareRates(
    organizationId: string,
    orderId: string,
    weightKg?: number,
  ): Promise<CargoRateComparison[]> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId, deletedAt: null },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }

    const params = buildRateParamsFromOrder(order, weightKg);
    const connections = await this.getActiveCargoConnections(organizationId);

    const settled = await Promise.allSettled(
      connections.map((conn) => this.getAdapterRate(conn, params)),
    );

    const rows: CargoRateComparison[] = [];
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

  private async getAdapterRate(
    conn: CargoConnection,
    params: RateParams,
  ): Promise<CargoRateComparison | null> {
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
        connectionId: conn.id,
        provider: String(conn.provider),
        providerLabel: CARGO_PROVIDER_LABEL_TR[String(conn.provider)] ?? String(conn.provider),
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

function buildRateParamsFromOrder(
  order: {
    shippingAddress: string | null;
  },
  weightKg?: number,
): RateParams {
  const addr = (order.shippingAddress ?? '').trim();
  const { city, district, line } = splitAddressLine(addr);
  const w = weightKg !== undefined && Number.isFinite(weightKg) ? weightKg : 1;
  return {
    fromCountryCode: 'TR',
    toCountryCode: 'TR',
    fromPostalCode: '34000',
    toPostalCode: '34000',
    fromCity: 'Istanbul',
    toCity: city.length > 0 ? city : district,
    weightKg: Math.max(0.1, w),
    desi: 1,
  };
}

function splitAddressLine(address: string): {
  line: string;
  city: string;
  district: string;
} {
  const line = address.trim();
  if (line.length === 0) {
    return { line: '', city: 'GENEL', district: 'MERKEZ' };
  }
  const parts = line
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length >= 3) {
    return {
      line,
      city: parts[parts.length - 2] ?? 'GENEL',
      district: parts[parts.length - 1] ?? 'MERKEZ',
    };
  }
  if (parts.length === 2) {
    return { line, city: parts[0] ?? 'GENEL', district: parts[1] ?? 'MERKEZ' };
  }
  return { line, city: 'GENEL', district: 'MERKEZ' };
}
