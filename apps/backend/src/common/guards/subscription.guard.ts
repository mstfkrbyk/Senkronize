import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const REQUIRES_PLAN_KEY = 'requiresPlan';

export const RequiresPlan = (plan: PlanTier) =>
  SetMetadata(REQUIRES_PLAN_KEY, plan);

const PLAN_HIERARCHY: Record<PlanTier, number> = {
  BASLANGIC: 0,
  GELISIM: 1,
  PRO: 2,
  KURUMSAL: 3,
};

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPlan = this.reflector.getAllAndOverride<PlanTier>(
      REQUIRES_PLAN_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPlan) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: { currentOrgId?: string } }>();
    const orgId: string | undefined = request.user?.currentOrgId;
    if (!orgId) {
      return false;
    }

    const subscription = await this.prisma.subscription.findUnique({
      where: { organizationId: orgId },
    });
    if (!subscription || subscription.status === 'CANCELLED') {
      throw new HttpException(
        'Aktif abonelik bulunamadı',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    if (PLAN_HIERARCHY[subscription.plan] < PLAN_HIERARCHY[requiredPlan]) {
      throw new HttpException(
        `Bu özellik için ${requiredPlan} paketi gereklidir`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return true;
  }
}
