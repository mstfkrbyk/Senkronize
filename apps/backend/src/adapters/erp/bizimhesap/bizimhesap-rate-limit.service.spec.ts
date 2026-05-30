import { BizimHesapRateLimitBlockedException } from './bizimhesap-rate-limit.exceptions';
import { BizimHesapRateLimitService } from './bizimhesap-rate-limit.service';

describe('BizimHesapRateLimitService', () => {
  const activityLog = {
    append: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue([]),
  };
  const integrationPolicy = {
    getMaxRequestsPerHour: jest.fn().mockResolvedValue(10),
    getMinSyncIntervalMsForHourlyCap: jest.fn().mockResolvedValue(360_000),
  };

  function createService(cacheStore = new Map<string, string>()) {
    const cache = {
      get: jest.fn(async (key: string) => {
        const raw = cacheStore.get(key);
        return raw ? (JSON.parse(raw) as unknown) : null;
      }),
      set: jest.fn(async (key: string, value: unknown, ttl: number) => {
        cacheStore.set(key, JSON.stringify(value));
        void ttl;
      }),
      del: jest.fn(async (key: string) => {
        cacheStore.delete(key);
      }),
    };
    return new BizimHesapRateLimitService(
      cache as never,
      integrationPolicy as never,
      activityLog as never,
    );
  }

  it('blocks requests while cooldown is active', async () => {
    const service = createService();
    const orgId = 'org-1';
    const blockedUntil = new Date(Date.now() + 60_000);
    await service['setCooldown'](orgId, blockedUntil, 'test', false);

    await expect(service.assertCanRequest(orgId)).rejects.toBeInstanceOf(
      BizimHesapRateLimitBlockedException,
    );
    const status = await service.getStatus(orgId);
    expect(status.blocked).toBe(true);
    expect(status.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('records 429 and enters cooldown', async () => {
    const service = createService();
    const orgId = 'org-2';
    await service.record429(orgId, { response: { status: 429 } }, '/products', 'GET');

    expect(await service.isBlocked(orgId)).toBe(true);
    expect(activityLog.append).toHaveBeenCalled();
  });
});
