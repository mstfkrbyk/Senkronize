import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Prisma, SubStatus, type Organization } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { AdminSubscriptionsQueryDto, UpdateOrgStatusDto } from './admin.dto';
import { SuperAdminGuard } from './admin.guard';

const ADMIN_ORG_LIST_INCLUDE = Prisma.validator<Prisma.OrganizationInclude>()({
  _count: {
    select: {
      users: { where: { deletedAt: null } },
      marketplaceConnections: { where: { deletedAt: null } },
    },
  },
  subscription: {
    select: { plan: true, status: true, trialEndsAt: true },
  },
});

type AdminOrganizationListItem = Prisma.OrganizationGetPayload<{
  include: typeof ADMIN_ORG_LIST_INCLUDE;
}>;

const ADMIN_SUBSCRIPTION_LIST_INCLUDE =
  Prisma.validator<Prisma.SubscriptionInclude>()({
    organization: { select: { id: true, name: true, suspended: true } },
  });

type AdminSubscriptionListItem = Prisma.SubscriptionGetPayload<{
  include: typeof ADMIN_SUBSCRIPTION_LIST_INCLUDE;
}>;

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('organizations')
  @ApiOperation({ summary: 'Tüm organizasyonlar (sayfalı)' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async getOrganizations(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ): Promise<{
    orgs: AdminOrganizationListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      ...(search && search.trim().length > 0
        ? {
            name: { contains: search.trim(), mode: 'insensitive' },
          }
        : {}),
    };

    const [orgs, total] = await Promise.all([
      this.prisma.organization.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: ADMIN_ORG_LIST_INCLUDE,
      }),
      this.prisma.organization.count({ where }),
    ]);

    return { orgs, total, page: Math.max(page, 1), limit: take };
  }

  @Get('subscriptions')
  @ApiOperation({ summary: 'Abonelik listesi (platform)' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async getSubscriptions(
    @Query() query: AdminSubscriptionsQueryDto,
  ): Promise<AdminSubscriptionListItem[]> {
    const where: Prisma.SubscriptionWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }
    return this.prisma.subscription.findMany({
      where,
      include: ADMIN_SUBSCRIPTION_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Platform istatistikleri' })
  @ApiResponse({ status: 200, description: 'Özet' })
  async getPlatformStats(): Promise<{
    totalOrgs: number;
    activeSubscriptions: number;
    totalConnections: number;
    totalOrders: number;
    trialOrgs: number;
  }> {
    const [
      totalOrgs,
      activeSubscriptions,
      totalConnections,
      totalOrders,
      trialOrgs,
    ] = await Promise.all([
      this.prisma.organization.count({ where: { deletedAt: null } }),
      this.prisma.subscription.count({ where: { status: SubStatus.ACTIVE } }),
      this.prisma.marketplaceConnection.count({
        where: { isActive: true, deletedAt: null },
      }),
      this.prisma.order.count({ where: { deletedAt: null } }),
      this.prisma.subscription.count({ where: { status: SubStatus.TRIAL } }),
    ]);
    return {
      totalOrgs,
      activeSubscriptions,
      totalConnections,
      totalOrders,
      trialOrgs,
    };
  }

  @Patch('organizations/:id/status')
  @ApiOperation({ summary: 'Organizasyon askıya al / aktif et' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async updateOrgStatus(
    @Param('id') id: string,
    @Body() body: UpdateOrgStatusDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Organization> {
    const existing = await this.prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException('Organizasyon bulunamadı.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.update({
        where: { id },
        data: { suspended: body.suspended },
      });
      await tx.auditLog.create({
        data: {
          actorUserId: actor.id,
          actorOrgId: actor.organizationId,
          impersonatedOrgId: null,
          action: body.suspended
            ? 'admin.organization_suspended'
            : 'admin.organization_unsuspended',
          resourceType: 'Organization',
          resourceId: id,
          metadata: { suspended: body.suspended },
        },
      });
      return org;
    });

    return updated;
  }
}
