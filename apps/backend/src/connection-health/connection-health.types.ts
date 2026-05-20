import type { CircuitBreakerState } from '../adapters/common/circuit-breaker.config';

export type ConnectionHealthStatus =
  | 'healthy'
  | 'warning'
  | 'error'
  | 'unknown';

export interface ConnectionRateLimitHealth {
  remaining: number;
  limit: number;
  resetAt: string | null;
}

export interface ConnectionHealthResponse {
  status: ConnectionHealthStatus;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  circuitBreaker: CircuitBreakerState;
  rateLimit: ConnectionRateLimitHealth;
  consecutiveErrors: number;
  responseTimeMs: number | null;
}
