import type { CargoProvider } from '@prisma/client';

export interface CarrierRecommendation {
  carrier: CargoProvider;
  estimatedCost: number;
  estimatedDays: number;
  score: number;
}
