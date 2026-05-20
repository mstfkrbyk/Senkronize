import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class DemoModeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (process.env.DEMO_MODE !== 'true') {
      return true;
    }

    if (context.getType() !== 'http') {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const { method, path } = request;

    const blockedPaths = [
      '/auth/register',
      '/subscription',
      '/subscriptions',
      '/api-keys',
    ];
    const isBlocked =
      blockedPaths.some((p) => path.includes(p)) && method !== 'GET';

    if (isBlocked) {
      throw new ForbiddenException('Demo modunda bu işlem yapılamaz');
    }
    return true;
  }
}
