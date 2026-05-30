import { ErpType, SyncFrequency } from '@prisma/client';

import { ErpSyncSettingsService } from './erp-sync-settings.service';

describe('ErpSyncSettingsService scheduling', () => {
  const integrationPolicy = {
    getMinSyncIntervalMsForHourlyCap: jest.fn().mockResolvedValue(6 * 60_000),
  };

  const service = new ErpSyncSettingsService(
    {} as never,
    {} as never,
    integrationPolicy as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-23T09:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses org syncFrequency for BizimHesap with platform minimum floor', async () => {
    const next = await service.getNextSyncTime({
      syncFrequency: SyncFrequency.EVERY_15_MIN,
      lastSyncAt: new Date('2026-05-23T09:00:00.000Z'),
      erpType: ErpType.BIZIMHESAP,
    });

    expect(next?.toISOString()).toBe('2026-05-23T09:15:00.000Z');
  });

  it('defers to blockedUntil when rate limit ends later than schedule', async () => {
    const next = await service.deferNextSyncAt(
      {
        syncFrequency: SyncFrequency.EVERY_15_MIN,
        lastSyncAt: new Date('2026-05-23T08:00:00.000Z'),
        erpConnection: { erpType: ErpType.BIZIMHESAP },
      },
      new Date('2026-05-23T10:00:00.000Z'),
    );

    expect(next.toISOString()).toBe('2026-05-23T10:00:00.000Z');
  });
});
