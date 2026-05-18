import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { ApiKeyAuthGuard } from './api-key-auth.guard';

const SK_LIVE = 'sk_live_';

function readBearerToken(req: {
  headers?: Record<string, string | string[] | undefined>;
}): string | null {
  const authz = req.headers?.authorization;
  if (typeof authz !== 'string' || !authz.startsWith('Bearer ')) {
    return null;
  }
  return authz.slice(7).trim();
}

function readXApiKey(req: {
  headers?: Record<string, string | string[] | undefined>;
}): string | null {
  const raw = req.headers?.['x-api-key'] ?? req.headers?.['X-Api-Key'];
  if (Array.isArray(raw)) {
    return typeof raw[0] === 'string' ? raw[0] : null;
  }
  return typeof raw === 'string' ? raw : null;
}

@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly jwtGuard: JwtAuthGuard,
    private readonly apiKeyGuard: ApiKeyAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const bearer = readBearerToken(req);
    const xKey = readXApiKey(req);
    const usesApiKey =
      (bearer != null && bearer.startsWith(SK_LIVE)) ||
      (xKey != null && xKey.startsWith(SK_LIVE));

    if (usesApiKey) {
      return (await this.apiKeyGuard.canActivate(context)) as boolean;
    }

    return (await this.jwtGuard.canActivate(context)) as boolean;
  }
}
