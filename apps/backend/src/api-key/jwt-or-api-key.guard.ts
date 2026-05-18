import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

const SK_LIVE = 'sk_live_';

function hasApiKey(req: {
  headers?: Record<string, string | string[] | undefined>;
}): boolean {
  const authz = req.headers?.authorization;
  if (typeof authz === 'string' && authz.startsWith('Bearer ')) {
    return authz.slice(7).trim().startsWith(SK_LIVE);
  }
  const xKey = req.headers?.['x-api-key'] ?? req.headers?.['X-Api-Key'];
  const key = Array.isArray(xKey) ? xKey[0] : xKey;
  return typeof key === 'string' && key.startsWith(SK_LIVE);
}

const JwtGuard = AuthGuard('jwt');
const ApiKeyGuard = AuthGuard('api-key');

@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();

    if (hasApiKey(req)) {
      const guard = new ApiKeyGuard();
      return (await guard.canActivate(context)) as boolean;
    }

    const guard = new JwtGuard();
    return (await guard.canActivate(context)) as boolean;
  }
}
