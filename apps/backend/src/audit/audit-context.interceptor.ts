import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, Subscription } from 'rxjs';

import type { ApiKeyAuthUser } from '../api-key/api-key.types';
import type { AuthenticatedUser } from '../auth/auth.types';

import { auditHttpContext, type AuditHttpContext } from './audit-context.storage';

@Injectable()
export class AuditContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: unknown }>();
    const mapped = this.mapRequestUser(req.user);
    if (!mapped) {
      return next.handle();
    }
    return new Observable((observer) => {
      let innerSub: Subscription | undefined;
      auditHttpContext.run(mapped, () => {
        innerSub = next.handle().subscribe(observer);
      });
      return () => innerSub?.unsubscribe();
    });
  }

  private mapRequestUser(user: unknown): AuditHttpContext | null {
    if (this.isApiKeyUser(user)) {
      return {
        kind: 'apiKey',
        apiKeyId: user.apiKeyId,
        actorOrgId: user.currentOrgId,
      };
    }
    if (this.isAuthenticatedUser(user)) {
      return {
        kind: 'user',
        actorUserId: user.id,
        actorOrgId: user.organizationId ?? user.currentOrgId,
        impersonatedOrgId: user.isImpersonating ? user.currentOrgId : null,
      };
    }
    return null;
  }

  private isApiKeyUser(u: unknown): u is ApiKeyAuthUser {
    return (
      typeof u === 'object' &&
      u !== null &&
      typeof (u as { apiKeyId?: unknown }).apiKeyId === 'string' &&
      typeof (u as { currentOrgId?: unknown }).currentOrgId === 'string'
    );
  }

  private isAuthenticatedUser(u: unknown): u is AuthenticatedUser {
    return (
      typeof u === 'object' &&
      u !== null &&
      typeof (u as { id?: unknown }).id === 'string' &&
      typeof (u as { currentOrgId?: unknown }).currentOrgId === 'string' &&
      typeof (u as { organizationId?: unknown }).organizationId ===
        'string' &&
      typeof (u as { isImpersonating?: unknown }).isImpersonating === 'boolean'
    );
  }
}
