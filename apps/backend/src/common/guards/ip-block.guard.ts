import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

import { IpBlockService } from '../../security/ip-block.service';

@Injectable()
export class IpBlockGuard implements CanActivate {
  constructor(private readonly ipBlock: IpBlockService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    const ip = this.ipBlock.normalizeClientIp(
      req.ip,
      req.headers['x-forwarded-for'],
    );
    if (await this.ipBlock.isBlocked(ip)) {
      throw new ForbiddenException('IP blocked');
    }
    return true;
  }
}
