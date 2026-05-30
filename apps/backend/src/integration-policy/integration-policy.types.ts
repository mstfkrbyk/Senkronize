import type { IntegrationPolicyCategory, SyncFrequency } from '@prisma/client';

import type {
  IntegrationPolicyFieldSchema,
  IntegrationRegistryEntry,
} from './integration-policy.schemas';

export interface IntegrationPolicyValues {
  enabled: boolean;
  orderSyncIntervalMinutes: number | null;
  orderLookbackMinutes: number | null;
  listingSyncIntervalMinutes: number | null;
  listingSyncHour: number | null;
  maxRequestsPerHour: number | null;
  requestsPerMinute: number | null;
  syncFrequency: SyncFrequency | null;
}

export interface IntegrationCircuitHealthView {
  platform: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  consecutiveFailures: number;
  halfOpenSuccesses: number;
  errorCountInWindow: number;
  openedAt: string | null;
  nextProbeAt: string | null;
  healthScore: number;
}

export interface AdminIntegrationListItem {
  platformKey: string;
  displayName: string;
  category: IntegrationPolicyCategory;
  categoryLabel: string;
  enabled: boolean;
  health: IntegrationCircuitHealthView;
  effectiveRpm: number;
  requestsToday: number;
  hasCustomPolicy: boolean;
  updatedAt: string | null;
}

export interface AdminIntegrationDetail {
  platformKey: string;
  displayName: string;
  category: IntegrationPolicyCategory;
  categoryLabel: string;
  schema: IntegrationRegistryEntry;
  fields: IntegrationPolicyFieldSchema[];
  values: IntegrationPolicyValues;
  effective: IntegrationPolicyValues;
  health: IntegrationCircuitHealthView;
  requestsToday: number;
  violationsToday: number;
  updatedAt: string | null;
  updatedByUserId: string | null;
}

export interface UpdateIntegrationPolicyInput {
  enabled?: boolean;
  orderSyncIntervalMinutes?: number | null;
  orderLookbackMinutes?: number | null;
  listingSyncIntervalMinutes?: number | null;
  listingSyncHour?: number | null;
  maxRequestsPerHour?: number | null;
  requestsPerMinute?: number | null;
  syncFrequency?: SyncFrequency | null;
}
