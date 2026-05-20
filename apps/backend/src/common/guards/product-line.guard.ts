import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgProductLine } from '@prisma/client';

import { orgHasProductLine, resolveOrgProductLines } from '../product-lines';
import { PrismaService } from '../../prisma/prisma.service';

export const REQUIRES_PRODUCT_KEY = 'requiresProduct';

export const RequireProduct = (line: OrgProductLine) =>
  SetMetadata(REQUIRES_PRODUCT_KEY, line);

@Injectable()
export class ProductLineGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<OrgProductLine>(
      REQUIRES_PRODUCT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { currentOrgId?: string };
    }>();
    const orgId = request.user?.currentOrgId;
    if (!orgId) {
      return false;
    }

    const org = await this.prisma.organization.findFirst({
      where: { id: orgId, deletedAt: null },
      select: { productLines: true },
    });
    const lines = resolveOrgProductLines(org?.productLines);
    if (!orgHasProductLine(lines, required)) {
      const label =
        required === OrgProductLine.ACCOUNTING
          ? 'Ön muhasebe'
          : 'Entegrasyon';
      throw new ForbiddenException(
        `Bu işlem için ${label} ürün hattı aboneliği gereklidir.`,
      );
    }

    return true;
  }
}
