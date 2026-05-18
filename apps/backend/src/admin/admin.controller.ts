import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Prisma } from '@prisma/client';

import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminOrganizationsQueryDto,
  AdminSubscriptionsQueryDto,
  ChangeOrganizationPlanDto,
  SuspendOrganizationDto,
} from './admin.dto';
import { SuperAdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import type {
  ActivityItem,
  HealthStats,
  OrganizationDetail,
  PaginatedOrganizations,
  PlatformStats,
  RevenueStats,
} from './admin.types';

const ADMIN_SUBSCRIPTION_LIST_INCLUDE =
  Prisma.validator<Prisma.SubscriptionInclude>()({
    organization: { select: { id: true, name: true, suspended: true } },
  });

type AdminSubscriptionListItem = Prisma.SubscriptionGetPayload<{
  include: typeof ADMIN_SUBSCRIPTION_LIST_INCLUDE;
}>;

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  @Get('stats/platform')
  @ApiOperation({ summary: 'Platform istatistikleri (genişletilmiş)' })
  @ApiResponse({ status: 200, description: 'Özet' })
  async getPlatformStats(): Promise<PlatformStats> {
    return this.adminService.getPlatformStats();
  }

  @Get('stats/revenue')
  @ApiOperation({ summary: 'Gelir ve MRR özeti' })
  @ApiResponse({ status: 200, description: 'Gelir' })
  async getRevenueStats(): Promise<RevenueStats> {
    return this.adminService.getRevenueStats();
  }

  @Get('organizations')
  @ApiOperation({ summary: 'Organizasyonlar (sayfalı, filtreli)' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async getOrganizations(
    @Query() query: AdminOrganizationsQueryDto,
  ): Promise<PaginatedOrganizations> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const plan = query.plan;
    return this.adminService.getActiveOrganizations(
      page,
      limit,
      query.search,
      plan,
      query.status,
    );
  }

  @Get('organizations/:id')
  @ApiOperation({ summary: 'Organizasyon detayı' })
  @ApiResponse({ status: 200, description: 'Detay' })
  async getOrganizationDetail(
    @Param('id') id: string,
  ): Promise<OrganizationDetail> {
    return this.adminService.getOrganizationDetail(id);
  }

  @Post('organizations/:id/suspend')
  @ApiOperation({ summary: 'Organizasyonu askıya al' })
  @ApiResponse({ status: 200, description: 'Askıya alındı' })
  async suspendOrganization(
    @Param('id') id: string,
    @Body() body: SuspendOrganizationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.adminService.suspendOrganization(id, body.reason, actor);
    return { ok: true };
  }

  @Post('organizations/:id/unsuspend')
  @ApiOperation({ summary: 'Askıyı kaldır' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async unsuspendOrganization(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.adminService.unsuspendOrganization(id, actor);
    return { ok: true };
  }

  @Post('organizations/:id/impersonate')
  @ApiOperation({ summary: 'Organizasyon adına geçici oturum jetonu' })
  @ApiResponse({ status: 200, description: 'JWT' })
  async impersonateOrganization(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ token: string }> {
    return this.adminService.impersonateOrganization(id, actor);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Son platform aktiviteleri (audit)' })
  @ApiResponse({ status: 200, description: 'Kayıtlar' })
  async getRecentActivity(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<ActivityItem[]> {
    return this.adminService.getRecentActivity(limit);
  }

  @Get('health')
  @ApiOperation({ summary: 'Pazaryeri bağlantı sağlığı (özet)' })
  @ApiResponse({ status: 200, description: 'Sağlık' })
  async getPlatformHealth(): Promise<HealthStats> {
    return this.adminService.getPlatformHealthStats();
  }

  @Patch('organizations/:id/plan')
  @ApiOperation({ summary: 'Abonelik paketini değiştir' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async changePlan(
    @Param('id') id: string,
    @Body() body: ChangeOrganizationPlanDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.adminService.changePlan(id, body.plan, body.reason, actor);
    return { ok: true };
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
}
