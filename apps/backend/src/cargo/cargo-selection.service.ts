import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CargoProvider } from '@prisma/client';

import { CargoPriceService } from './cargo-price.service';

const DEFAULT_TRANSIT_DAYS: Partial<Record<CargoProvider, number>> = {
  DHL: 2,
  FEDEX: 2,
  UPS: 3,
  TNT: 3,
  YURTICI: 2,
  ARAS: 2,
  MNG: 2,
  SURAT: 2,
  PTT: 3,
  PTT_KARGO: 3,
};

export interface CargoSelectionResult {
  provider: CargoProvider;
  estimatedCost: number;
  estimatedDays: number;
}

@Injectable()
export class CargoSelectionService {
  private readonly logger = new Logger(CargoSelectionService.name);

  constructor(private readonly cargoPriceService: CargoPriceService) {}

  async selectBestCargoProvider(params: {
    weight: number;
    fromCity: string;
    toCity: string;
    preferSpeed?: boolean;
    orgId: string;
  }): Promise<CargoSelectionResult> {
    const quotes = await this.cargoPriceService.compareCargoRates({
      orgId: params.orgId,
      weight: params.weight,
      fromCity: params.fromCity,
      toCity: params.toCity,
    });

    if (quotes.length === 0) {
      throw new NotFoundException('Aktif kargo bağlantısı veya fiyat teklifi bulunamadı');
    }

    const candidates = quotes.map((q) => {
      const provider = q.provider as CargoProvider;
      const estimatedDays =
        q.estimatedDays ??
        DEFAULT_TRANSIT_DAYS[provider] ??
        3;
      return {
        provider,
        estimatedCost: q.price,
        estimatedDays,
      };
    });

    const preferSpeed = params.preferSpeed === true;
    candidates.sort((a, b) => {
      if (preferSpeed) {
        if (a.estimatedDays !== b.estimatedDays) {
          return a.estimatedDays - b.estimatedDays;
        }
        return a.estimatedCost - b.estimatedCost;
      }
      if (a.estimatedCost !== b.estimatedCost) {
        return a.estimatedCost - b.estimatedCost;
      }
      return a.estimatedDays - b.estimatedDays;
    });

    const best = candidates[0];
    this.logger.debug('Kargo sağlayıcı seçildi', {
      organizationId: params.orgId,
      provider: best.provider,
      preferSpeed,
      estimatedCost: best.estimatedCost,
      estimatedDays: best.estimatedDays,
    });
    return best;
  }
}
