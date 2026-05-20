export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export const CIRCUIT_BREAKER_CONFIG = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30_000,
  monitoringWindow: 60_000,
} as const;
