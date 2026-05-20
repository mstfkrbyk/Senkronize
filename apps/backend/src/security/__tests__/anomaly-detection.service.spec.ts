import { AnomalyDetectionService } from '../anomaly-detection.service';

describe('AnomalyDetectionService', () => {
  it('getKnownIps returns empty when Redis unavailable', async () => {
    const cache = {
      smembers: jest.fn().mockResolvedValue(null),
      sismember: jest.fn(),
      sadd: jest.fn(),
      incrWithExpire: jest.fn(),
      set: jest.fn(),
      get: jest.fn(),
    };
    const email = { sendApiAnomalyAlert: jest.fn(), sendNewIpLoginAlert: jest.fn() };
    const prisma = {
      user: { findMany: jest.fn() },
      auditLog: { create: jest.fn() },
      anomalyLog: { create: jest.fn() },
      organization: { findFirst: jest.fn() },
    };
    const ipBlock = {
      normalizeClientIp: jest.fn(),
      setBlocked: jest.fn(),
    };
    const svc = new AnomalyDetectionService(
      cache as never,
      email as never,
      prisma as never,
      ipBlock as never,
    );
    await expect(svc.getKnownIps('user-1')).resolves.toEqual([]);
  });

  it('checkBulkOperation skips below threshold', async () => {
    const prisma = { anomalyLog: { create: jest.fn() } };
    const svc = new AnomalyDetectionService(
      {} as never,
      {} as never,
      prisma as never,
      {} as never,
    );
    await svc.checkBulkOperation('org-1', 'test', 10);
    expect(prisma.anomalyLog.create).not.toHaveBeenCalled();
  });
});
