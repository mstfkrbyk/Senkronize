import { describe, expect, it } from 'vitest';

import { normalizeConnectionHealthApiResponse } from './connection-health-mapper';

describe('normalizeConnectionHealthApiResponse', () => {
  it('maps backend health fields to panel DTO', () => {
    const dto = normalizeConnectionHealthApiResponse({
      status: 'healthy',
      lastSuccessAt: '2026-05-22T10:00:00.000Z',
      lastErrorAt: null,
      lastErrorMessage: null,
      circuitBreaker: 'CLOSED',
      rateLimit: {
        remaining: 80,
        limit: 100,
        resetAt: '2026-05-22T11:00:00.000Z',
      },
      consecutiveErrors: 0,
    });

    expect(dto.status).toBe('active');
    expect(dto.lastSuccessfulSyncAt).toBe('2026-05-22T10:00:00.000Z');
    expect(dto.rateLimit.used).toBe(20);
    expect(dto.hourlyStats).toHaveLength(24);
  });

  it('preserves pre-normalized panel payload', () => {
    const dto = normalizeConnectionHealthApiResponse({
      status: 'warning',
      lastSuccessfulSyncAt: '2026-05-22T09:00:00.000Z',
      lastErrorAt: null,
      lastErrorMessage: 'sync lag',
      circuitBreaker: 'HALF_OPEN',
      rateLimit: { used: 12, limit: 100, resetAt: null },
      syncErrorCount: 2,
      hourlyStats: [{ hour: '2026-05-22 10:00', success: 1, error: 0 }],
    });

    expect(dto.status).toBe('warning');
    expect(dto.syncErrorCount).toBe(2);
    expect(dto.hourlyStats).toEqual([
      { hour: '2026-05-22 10:00', success: 1, error: 0 },
    ]);
  });
});
