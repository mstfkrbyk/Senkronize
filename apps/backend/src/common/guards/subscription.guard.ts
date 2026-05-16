import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlanTier, SubStatus } from '@prisma/client';
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
    const now = new Date();

    if (!subscription) {
      throw new HttpException(
        'Aktif abonelik bulunamadı',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    if (
      subscription.status === SubStatus.EXPIRED ||
      subscription.status === SubStatus.PAUSED
    ) {
      throw new HttpException(
        'Abonelik bu işlem için uygun değil',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    if (subscription.status === SubStatus.CANCELLED) {
      if (now > subscription.currentPeriodEnd) {
        throw new HttpException(
          'Abonelik dönemi sona erdi',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    if (
      subscription.status === SubStatus.TRIAL &&
      subscription.trialEndsAt &&
      now > subscription.trialEndsAt
    ) {
      throw new HttpException(
        'Deneme süresi sona erdi',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const effectivePlan: PlanTier =
      subscription.status === SubStatus.TRIAL
        ? PlanTier.BASLANGIC
        : subscription.plan;

    if (PLAN_HIERARCHY[effectivePlan] < PLAN_HIERARCHY[requiredPlan]) {
      throw new HttpException(
        `Bu özellik için ${requiredPlan} paketi gereklidir`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }
    return true;
  }
}
