import { ForbiddenException, type ExecutionContext } from '@nestjs/common';

import { IpBlockGuard } from '../../common/guards/ip-block.guard';
import type { IpBlockService } from '../ip-block.service';

describe('IpBlockGuard', () => {
  it('allows when IP is not blocked', async () => {
    const ipBlock = {
      normalizeClientIp: jest.fn().mockReturnValue('203.0.113.1'),
      isBlocked: jest.fn().mockResolvedValue(false),
    } as unknown as IpBlockService;
    const guard = new IpBlockGuard(ipBlock);
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
      isBlocked: jest.fn().mockResolvedValue(true),
    } as unknown as IpBlockService;
    const guard = new IpBlockGuard(ipBlock);
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
