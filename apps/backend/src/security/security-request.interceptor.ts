import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';

import { AnomalyDetectionService } from './anomaly-detection.service';

@Injectable()
export class SecurityRequestInterceptor implements NestInterceptor {
  constructor(private readonly anomaly: AnomalyDetectionService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const req = context.switchToHttp().getRequest<Request & { user?: { currentOrgId?: string } }>();
    const orgId = req.user?.currentOrgId;
    if (typeof orgId === 'string') {
      void this.anomaly.recordHttpRequest(orgId);
    }
    return next.handle();
  }
}
