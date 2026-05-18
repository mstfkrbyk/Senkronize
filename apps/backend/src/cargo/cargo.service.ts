import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CargoProvider } from '@prisma/client';

import { createCargoAdapter } from '../adapters/cargo/cargo-adapter.factory';
import type {
  CreateShipmentParams,
  ShipmentResult,
  TrackingResult,
} from '../adapters/cargo-adapter.interface';
import { EncryptionService } from '../common/encryption/encryption.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CargoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async createShipment(
    organizationId: string,
    orderId: string,
    cargoProvider: CargoProvider,
  ): Promise<ShipmentResult> {
    const connection = await this.prisma.cargoConnection.findUnique({
      where: {
        organizationId_provider: { organizationId, provider: cargoProvider },
      },
    });
    if (!connection || !connection.isActive) {
      throw new BadRequestException('Bu kargo firması için aktif bağlantı bulunamadı');
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId, deletedAt: null },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }

    const creds = this.parseCredentials(connection.credentialsEnc);
    if (Object.keys(creds).length === 0) {
      throw new BadRequestException('Kargo bağlantısı kimlik bilgileri eksik');
    }

    const adapter = createCargoAdapter(cargoProvider, creds);
    const params = this.buildShipmentParams(order);
    const result = await adapter.createShipment(params);

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        cargoTrackingNumber: result.trackingCode,
        cargoProvider: String(cargoProvider),
      },
    });

    return result;
  }

  async trackShipment(
    organizationId: string,
    trackingCode: string,
    cargoProvider?: CargoProvider,
  ): Promise<TrackingResult> {
    const provider = await this.resolveProvider(
      organizationId,
      trackingCode,
      cargoProvider,
    );
    const connection = await this.prisma.cargoConnection.findUnique({
      where: {
        organizationId_provider: { organizationId, provider },
      },
    });
    if (!connection || !connection.isActive) {
      throw new BadRequestException('Bu kargo firması için aktif bağlantı bulunamadı');
    }

    const creds = this.parseCredentials(connection.credentialsEnc);
    if (Object.keys(creds).length === 0) {
      throw new BadRequestException('Kargo bağlantısı kimlik bilgileri eksik');
    }

    const adapter = createCargoAdapter(provider, creds);
    const result = await adapter.trackShipment(trackingCode);

    await this.prisma.order.updateMany({
      where: {
        organizationId,
        deletedAt: null,
        cargoTrackingNumber: trackingCode,
      },
      data: {
        cargoProvider: String(provider),
      },
    });

    return result;
  }

  async cancelShipment(
    organizationId: string,
    trackingCode: string,
    cargoProvider?: CargoProvider,
  ): Promise<void> {
    const provider = await this.resolveProvider(
      organizationId,
      trackingCode,
      cargoProvider,
    );
    const connection = await this.prisma.cargoConnection.findUnique({
      where: {
        organizationId_provider: { organizationId, provider },
      },
    });
    if (!connection || !connection.isActive) {
      throw new BadRequestException('Bu kargo firması için aktif bağlantı bulunamadı');
    }

    const creds = this.parseCredentials(connection.credentialsEnc);
    if (Object.keys(creds).length === 0) {
      throw new BadRequestException('Kargo bağlantısı kimlik bilgileri eksik');
    }

    const adapter = createCargoAdapter(provider, creds);
    await adapter.cancelShipment(trackingCode);
  }

  private async resolveProvider(
    organizationId: string,
    trackingCode: string,
    explicit?: CargoProvider,
  ): Promise<CargoProvider> {
    if (explicit) {
      return explicit;
    }
    const order = await this.prisma.order.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        cargoTrackingNumber: trackingCode,
      },
      select: { cargoProvider: true },
    });
    const raw = order?.cargoProvider?.trim();
    if (
      raw &&
      (Object.values(CargoProvider) as string[]).includes(raw)
    ) {
      return raw as CargoProvider;
    }
    throw new BadRequestException(
      'Kargo firması bilinmiyor. Sorguya cargoProvider ekleyin veya siparişe önce takip numarası kaydedin.',
    );
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

  private buildShipmentParams(order: {
    platformOrderId: string;
    customerName: string;
    customerPhone: string | null;
    shippingAddress: string | null;
  }): CreateShipmentParams {
    const addr = (order.shippingAddress ?? '').trim();
    const { city, district, line } = splitAddressLine(addr);
    return {
      orderId: order.platformOrderId,
      receiverName: order.customerName,
      receiverPhone:
        order.customerPhone && order.customerPhone.trim().length > 0
          ? order.customerPhone.trim()
          : '05000000000',
      receiverAddress: line.length > 0 ? line : 'Adres bilgisi yok',
      receiverCity: city,
      receiverDistrict: district,
      weight: 1,
      desi: 1,
    };
  }
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
