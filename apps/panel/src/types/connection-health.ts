export type ConnectionHealthStatus = 'active' | 'warning' | 'error' | 'inactive';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface ConnectionHealthHourlyStat {
  hour: string;
  success: number;
  error: number;
}

export interface ConnectionHealthDto {
  status: ConnectionHealthStatus;
  lastSuccessfulSyncAt: string | null;
  lastErrorMessage: string | null;
  lastErrorAt: string | null;
  syncErrorCount: number;
  rateLimit: {
    used: number;
    limit: number;
    resetAt: string | null;
  };
  circuitBreaker: CircuitBreakerState;
  hourlyStats: ConnectionHealthHourlyStat[];
}
