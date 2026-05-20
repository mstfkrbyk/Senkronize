import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import { RateLimitMonitorService } from '../../monitoring/rate-limit-monitor.service';
import { IpBlockService } from '../../security/ip-block.service';

@Injectable()
export class IpBlockGuard implements CanActivate {
  constructor(
    private readonly ipBlock: IpBlockService,
    private readonly rateLimitMonitor: RateLimitMonitorService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    const ip = this.ipBlock.normalizeClientIp(
      req.ip,
      req.headers['x-forwarded-for'],
    );

    const outcome = await this.ipBlock.recordRequest(ip);
    if (outcome === 'permanent_blocked' || outcome === 'temp_blocked') {
      if (ip) {
        void this.rateLimitMonitor.recordIpRateLimitViolation(ip);
      }
      throw new ForbiddenException('IP blocked');
    }

    return true;
  }
}
