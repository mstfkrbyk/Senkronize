import { ForbiddenException, type ExecutionContext } from '@nestjs/common';

import { IpBlockGuard } from '../../common/guards/ip-block.guard';
import type { RateLimitMonitorService } from '../../monitoring/rate-limit-monitor.service';
import type { IpBlockService } from '../ip-block.service';

describe('IpBlockGuard', () => {
  it('allows when IP is not blocked', async () => {
    const ipBlock = {
      normalizeClientIp: jest.fn().mockReturnValue('203.0.113.1'),
      recordRequest: jest.fn().mockResolvedValue('ok'),
    } as unknown as IpBlockService;
    const rateLimitMonitor = {
      recordIpRateLimitViolation: jest.fn(),
    } as unknown as RateLimitMonitorService;
    const guard = new IpBlockGuard(ipBlock, rateLimitMonitor);
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '203.0.113.1',
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('throws when IP is blocked', async () => {
    const ipBlock = {
      normalizeClientIp: jest.fn().mockReturnValue('203.0.113.9'),
      recordRequest: jest.fn().mockResolvedValue('permanent_blocked'),
    } as unknown as IpBlockService;
    const rateLimitMonitor = {
      recordIpRateLimitViolation: jest.fn(),
    } as unknown as RateLimitMonitorService;
    const guard = new IpBlockGuard(ipBlock, rateLimitMonitor);
    const context = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          ip: '203.0.113.9',
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
