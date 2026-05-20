import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { CargoProvider, Order } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

import { CargoRateService } from './cargo-rate.service';
import type { CarrierRecommendation } from './cargo-optimizer.types';

/** Varsayılan maksimum ağırlık (kg) — bağlantı meta yoksa */
const DEFAULT_MAX_WEIGHT_KG: Partial<Record<CargoProvider, number>> = {
  TNT: 30,
  GLS: 31.5,
  DPD: 31.5,
  HERMES: 15,
  POSTNL: 23,
  DHL_PARCEL: 31.5,
  DHL: 70,
  UPS: 70,
  FEDEX: 68,
  BRINGO: 30,
  CEVA: 50,
  NART_KARGO: 30,
  KOLAY_GELSIN: 30,
  YURTICI: 50,
  ARAS: 50,
  MNG: 50,
  SURAT: 50,
};

const DEFAULT_TRANSIT_DAYS: Partial<Record<CargoProvider, number>> = {
  TNT: 3,
  GLS: 4,
  DPD: 4,
  HERMES: 3,
  POSTNL: 4,
  DHL_PARCEL: 3,
  BRINGO: 2,
  CEVA: 3,
  NART_KARGO: 2,
  KOLAY_GELSIN: 2,
};

const WEIGHT_PRICE_SPEED_SUCCESS = [0.35, 0.25, 0.25, 0.15] as const;

@Injectable()
export class CargoOptimizerService {
  private readonly logger = new Logger(CargoOptimizerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cargoRateService: CargoRateService,
  ) {}

  async getOptimalCarrierForOrder(
    organizationId: string,
    orderId: string,
  ): Promise<CarrierRecommendation> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId, deletedAt: null },
    });
    if (!order) {
      throw new NotFoundException('Sipariş bulunamadı');
    }

    const connections = await this.prisma.cargoConnection.findMany({
      where: { organizationId, isActive: true },
      select: { provider: true },
    });
    const availableCarriers = connections.map((c) => c.provider);
    if (availableCarriers.length === 0) {
      throw new NotFoundException('Aktif kargo bağlantısı bulunamadı');
    }

    return this.selectOptimalCarrier(organizationId, order, availableCarriers);
  }

  async selectOptimalCarrier(
    orgId: string,
    order: Order,
    availableCarriers: CargoProvider[],
  ): Promise<CarrierRecommendation> {
    const weightKg = 1;
    const rateRows = await this.cargoRateService.compareRates(orgId, order.id, weightKg);
    const rateByProvider = new Map(
      rateRows.map((r) => [r.provider, r] as const),
    );

    const successRates = await this.loadDeliverySuccessRates(orgId, availableCarriers);

    const metrics: Array<{
      carrier: CargoProvider;
      estimatedCost: number;
      estimatedDays: number;
      successRate: number;
    }> = [];

    for (const carrier of availableCarriers) {
      const maxKg = DEFAULT_MAX_WEIGHT_KG[carrier] ?? 30;
      if (weightKg > maxKg) {
        continue;
      }

      const rate = rateByProvider.get(String(carrier));
      metrics.push({
        carrier,
        estimatedCost: rate?.price ?? this.fallbackCost(carrier),
        estimatedDays:
          rate?.estimatedTransitDays ?? DEFAULT_TRANSIT_DAYS[carrier] ?? 3,
        successRate: successRates.get(carrier) ?? 0.75,
      });
    }

    const allCosts = metrics.map((m) => m.estimatedCost);
    const allDays = metrics.map((m) => m.estimatedDays);
    const candidates: CarrierRecommendation[] = metrics.map((m) => ({
      carrier: m.carrier,
      estimatedCost: m.estimatedCost,
      estimatedDays: m.estimatedDays,
      score: this.computeScore(
        m.estimatedCost,
        m.estimatedDays,
        m.successRate,
        allCosts,
        allDays,
      ),
    }));

    if (candidates.length === 0) {
      const fallback = availableCarriers[0];
      return {
        carrier: fallback,
        estimatedCost: this.fallbackCost(fallback),
        estimatedDays: DEFAULT_TRANSIT_DAYS[fallback] ?? 3,
        score: 0.5,
      };
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    this.logger.debug('Optimal kargo seçildi', {
      organizationId: orgId,
      carrier: best.carrier,
      score: best.score,
    });
    return best;
  }

  private computeScore(
    cost: number,
    days: number,
    successRate: number,
    allCosts: number[],
    allDays: number[],
  ): number {
    const minCost = Math.min(...allCosts);
    const maxCost = Math.max(...allCosts);
    const minDays = Math.min(...allDays);
    const maxDays = Math.max(...allDays);

    const priceScore =
      maxCost > minCost ? 1 - (cost - minCost) / (maxCost - minCost) : 1;
    const speedScore =
      maxDays > minDays ? 1 - (days - minDays) / (maxDays - minDays) : 1;
    const successScore = Math.min(1, Math.max(0, successRate));

    return (
      WEIGHT_PRICE_SPEED_SUCCESS[0] * priceScore +
      WEIGHT_PRICE_SPEED_SUCCESS[1] * speedScore +
      WEIGHT_PRICE_SPEED_SUCCESS[2] * successScore +
      WEIGHT_PRICE_SPEED_SUCCESS[3] * 1
    );
  }

  private fallbackCost(carrier: CargoProvider): number {
    const defaults: Partial<Record<CargoProvider, number>> = {
      TNT: 120,
      GLS: 95,
      DPD: 90,
      HERMES: 85,
      POSTNL: 88,
      DHL_PARCEL: 92,
      BRINGO: 45,
      CEVA: 55,
      NART_KARGO: 40,
      KOLAY_GELSIN: 38,
    };
    return defaults[carrier] ?? 50;
  }

  private async loadDeliverySuccessRates(
    organizationId: string,
    carriers: CargoProvider[],
  ): Promise<Map<CargoProvider, number>> {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const orders = await this.prisma.order.findMany({
      where: {
        organizationId,
        deletedAt: null,
        cargoProvider: { in: carriers.map(String) },
        cargoTrackingNumber: { not: null },
        platformCreatedAt: { gte: since },
      },
      select: { cargoProvider: true, status: true },
    });

    const totals = new Map<string, { shipped: number; delivered: number }>();
    for (const o of orders) {
      const key = o.cargoProvider?.trim();
      if (!key) {
        continue;
      }
      const row = totals.get(key) ?? { shipped: 0, delivered: 0 };
      row.shipped += 1;
      if (o.status === 'DELIVERED') {
        row.delivered += 1;
      }
      totals.set(key, row);
    }

    const out = new Map<CargoProvider, number>();
    for (const c of carriers) {
      const row = totals.get(String(c));
      if (!row || row.shipped === 0) {
        out.set(c, 0.75);
      } else {
        out.set(c, row.delivered / row.shipped);
      }
    }
    return out;
  }

}
