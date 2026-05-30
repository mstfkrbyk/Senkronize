import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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
import { resolveOrganizationAccountingMode } from '../common/accounting-mode';
import { resolveOrgProductLines } from '../common/product-lines';
import { AuditService } from '../audit/audit.service';
import { IntegrationPolicyModule } from '../integration-policy/integration-policy.module';
import { IntegrationPolicyService } from '../integration-policy/integration-policy.service';
import type {
  AdminIntegrationDetail,
  AdminIntegrationListItem,
} from '../integration-policy/integration-policy.types';
import { UpdateIntegrationPolicyDto } from '../integration-policy/integration-policy.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformHealthService } from '../adapters/common/platform-health.service';
import { BizimHesapRateLimitService } from '../adapters/erp/bizimhesap/bizimhesap-rate-limit.service';
import { RateLimitMonitorService } from '../monitoring/rate-limit-monitor.service';
import { PlatformActivityLogService } from '../monitoring/platform-activity-log.service';
import { IpBlockService } from '../security/ip-block.service';
import { AuditLogsQueryDto } from '../users/audit-logs-query.dto';
import { UsersService } from '../users/users.service';
import {
  AddOrgNoteDto,
  AdminOrganizationsQueryDto,
  AdminPlatformStatsQueryDto,
  AdminSubscriptionsQueryDto,
  AdminUsersQueryDto,
  BlockedIpMutationDto,
  ChangeAdminUserRoleDto,
  AssignOrganizationPartnerDto,
  ChangeOrganizationPlanDto,
  ConfigureInternalAccountDto,
  ChangeOrganizationSubscriptionDto,
  ChangeOrganizationProductLinesDto,
  ChangeOrganizationAccountingModeDto,
  GrantExtraErpSlotDto,
  GrowthStatsQueryDto,
  SuspendOrganizationDto,
  UpdateAdminOrganizationInfoDto,
  UpdateAdminUserDto,
} from './admin.dto';
import { SuperAdminGuard } from './admin.guard';
import {
  PartnerLinkStatus,
  type PartnerLinkRequest,
} from '@prisma/client';
import {
  AdminPartnerPayoutQueryDto,
  RejectPartnerLinkRequestDto,
  RejectPartnerPayoutDto,
  UpdatePartnerCommissionRateDto,
} from '../partner/partner.dto';
import { ensureArray, ensureFiniteNumber } from '../common/ensure-array.util';
import { PartnerLinkService } from '../partner/partner-link.service';
import { PartnerService } from '../partner/partner.service';
import { AdminService } from './admin.service';
import { AdminStatsService } from './admin-stats.service';
import type {
  ActivityItem,
  ActivitySummary,
  AdminUserDetail,
  CohortData,
  GrowthMetrics,
  GrowthPeriod,
  HealthStats,
  MrrHistoryPoint,
  OrgNoteItem,
  OrganizationDetail,
  PaginatedOrganizations,
  PaginatedUsers,
  AdminSubscriptionListItem,
  PlatformStats,
  PlatformUsageItem,
  RevenueStats,
} from './admin.types';

const ADMIN_SUBSCRIPTION_LIST_INCLUDE =
  Prisma.validator<Prisma.SubscriptionInclude>()({
    organization: {
      select: {
        id: true,
        name: true,
        suspended: true,
        productLines: true,
        accountingMode: true,
        _count: {
          select: {
            erpConnections: { where: { deletedAt: null, isActive: true } },
          },
        },
      },
    },
  });

type AdminSubscriptionListRow = Prisma.SubscriptionGetPayload<{
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
    private readonly adminStatsService: AdminStatsService,
    private readonly usersService: UsersService,
    private readonly ipBlockService: IpBlockService,
    private readonly platformHealthService: PlatformHealthService,
    private readonly rateLimitMonitor: RateLimitMonitorService,
    private readonly partnerService: PartnerService,
    private readonly partnerLinkService: PartnerLinkService,
    private readonly integrationPolicy: IntegrationPolicyService,
    private readonly auditService: AuditService,
    private readonly bizimHesapRateLimit: BizimHesapRateLimitService,
    private readonly platformActivityLog: PlatformActivityLogService,
  ) {}

  @Get('stats/platform')
  @ApiOperation({ summary: 'Platform istatistikleri (genişletilmiş)' })
  @ApiResponse({ status: 200, description: 'Özet' })
  async getPlatformStats(
    @Query() query: AdminPlatformStatsQueryDto,
  ): Promise<PlatformStats> {
    return this.adminService.getPlatformStats(query.product);
  }

  @Get('stats/revenue')
  @ApiOperation({ summary: 'Gelir ve MRR özeti' })
  @ApiResponse({ status: 200, description: 'Gelir' })
  async getRevenueStats(): Promise<RevenueStats> {
    return this.adminService.getRevenueStats();
  }

  @Get('stats/growth')
  @ApiOperation({ summary: 'Büyüme metrikleri (MRR, churn, yeni kayıt)' })
  @ApiResponse({ status: 200, description: 'Büyüme' })
  async getGrowthStats(
    @Query() query: GrowthStatsQueryDto,
  ): Promise<GrowthMetrics> {
    const period: GrowthPeriod = query.period ?? '30d';
    return this.adminStatsService.getGrowthMetrics(period);
  }

  @Get('stats/platform-usage')
  @ApiOperation({ summary: 'Platform kullanım istatistikleri' })
  @ApiResponse({ status: 200, description: 'Kullanım' })
  async getPlatformUsageStats(): Promise<PlatformUsageItem[]> {
    return this.adminStatsService.getPlatformUsageStats();
  }

  @Get('stats/mrr-history')
  @ApiOperation({ summary: 'Son 12 ay MRR ve büyüme serisi' })
  @ApiResponse({ status: 200, description: 'MRR geçmişi' })
  async getMrrHistory(): Promise<MrrHistoryPoint[]> {
    return this.adminStatsService.getMrrHistory();
  }

  @Get('stats/cohort-retention')
  @ApiOperation({ summary: 'Cohort retention analizi' })
  @ApiResponse({ status: 200, description: 'Cohort' })
  async getCohortRetention(): Promise<CohortData[]> {
    return this.adminStatsService.getCohortRetention();
  }

  @Get('users')
  @ApiOperation({ summary: 'Tüm kullanıcılar (sayfalı, filtreli)' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async getUsers(@Query() query: AdminUsersQueryDto): Promise<PaginatedUsers> {
    return this.adminService.getUsers(query);
  }

  @Get('users/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="kullanicilar.csv"')
  @ApiOperation({ summary: 'Kullanıcı listesi CSV (en fazla 500, filtreli)' })
  @ApiResponse({ status: 200, description: 'CSV' })
  async exportUsers(
    @Query() query: AdminUsersQueryDto,
    @Query('format') format: string,
  ): Promise<string> {
    if (format !== 'csv') {
      throw new BadRequestException('Yalnızca format=csv desteklenir');
    }
    return this.adminService.exportUsersCsv(query);
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Kullanıcı detayı' })
  @ApiResponse({ status: 200, description: 'Detay' })
  async getUserDetail(
    @Param('userId') userId: string,
  ): Promise<AdminUserDetail> {
    return this.adminService.getUserDetail(userId);
  }

  @Patch('users/:userId/role')
  @ApiOperation({ summary: 'Kullanıcı rolünü değiştir' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async changeUserRole(
    @Param('userId') userId: string,
    @Body() body: ChangeAdminUserRoleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.adminService.changeUserRole(userId, body.role, actor);
    return { ok: true };
  }

  @Patch('users/:userId/suspend')
  @ApiOperation({ summary: 'Kullanıcıyı askıya al' })
  @ApiResponse({ status: 200, description: 'Askıya alındı' })
  async suspendUser(
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.adminService.suspendUser(userId, actor);
    return { ok: true };
  }

  @Patch('users/:userId/unsuspend')
  @ApiOperation({ summary: 'Kullanıcı askısını kaldır' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async unsuspendUser(
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.adminService.unsuspendUser(userId, actor);
    return { ok: true };
  }

  @Post('users/:userId/reset-password')
  @ApiOperation({ summary: 'Kullanıcı şifresini sıfırla (e-posta)' })
  @ApiResponse({ status: 200, description: 'E-posta gönderildi' })
  async resetUserPassword(
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    return this.adminService.resetUserPassword(userId, actor);
  }

  @Delete('users/:userId/sessions')
  @ApiOperation({ summary: 'Kullanıcı oturumlarını sonlandır' })
  @ApiResponse({ status: 200, description: 'Sonlandırıldı' })
  async revokeUserSessions(
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.adminService.revokeUserSessions(userId, actor);
    return { ok: true };
  }

  @Patch('users/:userId')
  @ApiOperation({ summary: 'Admin: Kullanıcı bilgilerini güncelle' })
  async updateUserInfo(
    @Param('userId') userId: string,
    @Body() dto: UpdateAdminUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.adminService.updateUserInfo(userId, dto, actor);
  }

  @Get('users/:userId/audit-log')
  @ApiOperation({ summary: 'Kullanıcı denetim kayıtları' })
  @ApiResponse({ status: 200, description: 'Sayfalı kayıtlar' })
  async getUserAuditLogs(
    @Param('userId') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.adminService.getUserAuditLogs(userId, page, limit);
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
      query.product,
      query.partner,
      query.accountingMode,
    );
  }

  @Get('organizations/platform')
  @ApiOperation({ summary: 'Platform (süper admin) organizasyonu' })
  @ApiResponse({ status: 200, description: 'Platform org özeti' })
  async getPlatformOrganization(): Promise<{
    id: string;
    name: string;
    slug: string;
  } | null> {
    return this.adminService.getPlatformOrganization();
  }

  @Get('organizations/:id')
  @ApiOperation({ summary: 'Organizasyon detayı' })
  @ApiResponse({ status: 200, description: 'Detay' })
  async getOrganizationDetail(
    @Param('id') id: string,
  ): Promise<OrganizationDetail> {
    return this.adminService.getOrganizationDetail(id);
  }

  @Patch('organizations/:id/internal-account')
  @ApiOperation({
    summary: 'İç hesap (faturasız, sınırsız limit) yapılandırması',
  })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async configureInternalAccount(
    @Param('id') id: string,
    @Body() body: ConfigureInternalAccountDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.adminService.configureInternalAccount(id, body, actor);
    return { ok: true };
  }

  @Post('organizations/:id/extra-erp-slot')
  @ApiOperation({ summary: 'Organizasyona ek ERP slotu (addon) tanımla' })
  @ApiResponse({ status: 200, description: 'Addon güncellendi' })
  async grantExtraErpSlot(
    @Param('id') id: string,
    @Body() body: GrantExtraErpSlotDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{
    extraErpSlotCount: number;
    erpSlotLimit: number | null;
  }> {
    return this.adminService.grantExtraErpSlot(
      id,
      body.quantity,
      body.reason,
      actor,
    );
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
  ): Promise<{ token: string; impersonationToken: string }> {
    return this.adminService.impersonateOrganization(id, actor);
  }

  @Get('activity/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="platform-denetim.csv"')
  @ApiOperation({ summary: 'Platform denetim kayıtları CSV (en fazla 500)' })
  @ApiResponse({ status: 200, description: 'CSV' })
  async exportRecentActivity(
    @Query('format') format: string,
  ): Promise<string> {
    if (format !== 'csv') {
      throw new BadRequestException('Yalnızca format=csv desteklenir');
    }
    return this.adminService.exportPlatformActivityCsv();
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

  @Patch('organizations/:id/subscription')
  @ApiOperation({ summary: 'Abonelik durumu ve deneme bitiş tarihi' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async updateSubscription(
    @Param('id') id: string,
    @Body() body: ChangeOrganizationSubscriptionDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.adminService.updateSubscription(id, body, actor);
    return { ok: true };
  }

  @Patch('organizations/:id/product-lines')
  @ApiOperation({ summary: 'Ürün hattını değiştir (entegrasyon / muhasebe / paket)' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async changeProductLines(
    @Param('id') id: string,
    @Body() body: ChangeOrganizationProductLinesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.adminService.changeProductLines(
      id,
      body.productSelection,
      body.reason,
      actor,
    );
    return { ok: true };
  }

  @Patch('organizations/:id/accounting-mode')
  @ApiOperation({ summary: 'Muhasebe modunu değiştir (NATIVE / EXTERNAL_ERP)' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async changeAccountingMode(
    @Param('id') id: string,
    @Body() body: ChangeOrganizationAccountingModeDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.adminService.changeAccountingMode(
      id,
      body.accountingMode,
      body.reason,
      actor,
    );
    return { ok: true };
  }

  @Put('organizations/:id/partner')
  @ApiOperation({ summary: 'Müşteri organizasyonuna partner ata' })
  @ApiResponse({ status: 200, description: 'Atandı' })
  async assignPartner(
    @Param('id') id: string,
    @Body() body: AssignOrganizationPartnerDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.adminService.assignPartnerToOrganization(
      id,
      body.partnerOrgId,
      actor,
      body.reason,
    );
    return { ok: true };
  }

  @Delete('organizations/:id/partner/:partnerOrgId')
  @ApiOperation({ summary: 'Partner bağlantısını kaldır' })
  @ApiResponse({ status: 200, description: 'Kaldırıldı' })
  async removePartner(
    @Param('id') id: string,
    @Param('partnerOrgId') partnerOrgId: string,
    @Query('reason') reason: string | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.adminService.removePartnerFromOrganization(
      id,
      partnerOrgId,
      actor,
      reason,
    );
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
    const rows = await this.prisma.subscription.findMany({
      where,
      include: ADMIN_SUBSCRIPTION_LIST_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => this.mapAdminSubscriptionListItem(row));
  }

  private mapAdminSubscriptionListItem(
    row: AdminSubscriptionListRow,
  ): AdminSubscriptionListItem {
    const { organization } = row;
    return {
      id: row.id,
      organizationId: row.organizationId,
      plan: row.plan,
      status: row.status,
      trialEndsAt: row.trialEndsAt,
      currentPeriodStart: row.currentPeriodStart,
      currentPeriodEnd: row.currentPeriodEnd,
      createdAt: row.createdAt,
      organization: {
        id: organization.id,
        name: organization.name,
        suspended: organization.suspended,
        orgProducts: resolveOrgProductLines(organization.productLines),
        accountingMode: resolveOrganizationAccountingMode(
          organization.accountingMode,
          organization._count.erpConnections,
        ),
      },
    };
  }

  @Post('blocked-ips')
  @ApiOperation({ summary: 'Engellenen IP ekle veya kaldır' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async mutateBlockedIp(
    @Body() dto: BlockedIpMutationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.ipBlockService.setBlocked(dto.ip, dto.blocked);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorOrgId: actor.organizationId ?? actor.currentOrgId,
        impersonatedOrgId: actor.isImpersonating ? actor.currentOrgId : null,
        action: dto.blocked ? 'admin.ip_block_add' : 'admin.ip_block_remove',
        resourceType: 'Security',
        resourceId: dto.ip,
        metadata: {},
      },
    });
    return { ok: true };
  }

  @Get('blocked-ips')
  @ApiOperation({ summary: 'Engellenen IP listesi' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async listBlockedIps(): Promise<{ ips: string[] }> {
    const ips = await this.ipBlockService.listBlocked();
    return { ips };
  }

  @Delete('blocked-ips/:ip')
  @ApiOperation({ summary: 'Engellenen IP kaydını kaldır' })
  @ApiResponse({ status: 200, description: 'Kaldırıldı' })
  async deleteBlockedIp(
    @Param('ip') ip: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.ipBlockService.unblock(ip);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorOrgId: actor.organizationId ?? actor.currentOrgId,
        impersonatedOrgId: actor.isImpersonating ? actor.currentOrgId : null,
        action: 'admin.ip_block_remove',
        resourceType: 'Security',
        resourceId: ip,
        metadata: {},
      },
    });
    return { ok: true };
  }

  @Get('platform-health')
  @ApiOperation({ summary: 'Platform devre kesici durumları' })
  @ApiResponse({ status: 200, description: 'Circuit breaker özeti' })
  async getCircuitPlatformHealth() {
    return this.platformHealthService.getAllPlatformHealth();
  }

  @Post('platform-health/:platform/reset')
  @ApiOperation({ summary: 'Platform devre kesicisini manuel sıfırla' })
  @ApiResponse({ status: 200, description: 'Sıfırlandı' })
  async resetPlatformCircuit(
    @Param('platform') platform: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.platformHealthService.resetCircuit(platform);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorOrgId: actor.organizationId ?? actor.currentOrgId,
        impersonatedOrgId: actor.isImpersonating ? actor.currentOrgId : null,
        action: 'admin.platform_circuit_reset',
        resourceType: 'PlatformHealth',
        resourceId: platform.toUpperCase(),
        metadata: {},
      },
    });
    return { ok: true };
  }

  @Get('rate-limit-stats')
  @ApiOperation({ summary: 'Rate limit ihlal ve platform istek metrikleri' })
  @ApiResponse({ status: 200, description: 'İstatistikler' })
  async getRateLimitStats() {
    return this.rateLimitMonitor.getStats();
  }

  @Get('partners')
  @ApiOperation({ summary: 'Partner organizasyonları ve komisyon oranları' })
  @ApiResponse({ status: 200 })
  async listPartners(): Promise<
    Awaited<ReturnType<PartnerService['listPartnersForAdmin']>>
  > {
    return ensureArray(await this.partnerService.listPartnersForAdmin());
  }

  @Get('partner-payout-requests')
  @ApiOperation({ summary: 'Partner ödeme talepleri' })
  @ApiResponse({ status: 200 })
  async listPartnerPayoutRequests(
    @Query() query: AdminPartnerPayoutQueryDto,
  ): Promise<
    Awaited<ReturnType<PartnerService['listPayoutRequestsForAdmin']>>
  > {
    return ensureArray(
      await this.partnerService.listPayoutRequestsForAdmin(query.status),
    );
  }

  @Post('partner-payout-requests/:id/approve')
  @ApiOperation({ summary: 'Partner ödeme talebini onayla' })
  @ApiResponse({ status: 200 })
  async approvePartnerPayoutRequest(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<PartnerService['approvePayoutRequest']>>> {
    return this.partnerService.approvePayoutRequest(
      id,
      actor.id,
      actor.organizationId ?? actor.currentOrgId,
    );
  }

  @Post('partner-payout-requests/:id/reject')
  @ApiOperation({ summary: 'Partner ödeme talebini reddet' })
  @ApiResponse({ status: 200 })
  async rejectPartnerPayoutRequest(
    @Param('id') id: string,
    @Body() body: RejectPartnerPayoutDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<Awaited<ReturnType<PartnerService['rejectPayoutRequest']>>> {
    return this.partnerService.rejectPayoutRequest(
      id,
      actor.id,
      actor.organizationId ?? actor.currentOrgId,
      body.note,
    );
  }

  @Patch('partners/:partnerOrgId/commission-rate')
  @ApiOperation({ summary: 'Partner komisyon oranını güncelle' })
  @ApiResponse({ status: 200 })
  async updatePartnerCommissionRate(
    @Param('partnerOrgId') partnerOrgId: string,
    @Body() body: UpdatePartnerCommissionRateDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ commissionRate: number }> {
    const profile = await this.partnerService.updatePartnerCommissionRate(
      partnerOrgId,
      body.rate,
    );
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorOrgId: actor.organizationId ?? actor.currentOrgId,
        impersonatedOrgId: actor.isImpersonating ? actor.currentOrgId : null,
        action: 'admin.partner_commission_rate_update',
        resourceType: 'PartnerProfile',
        resourceId: profile.id,
        metadata: { partnerOrgId, rate: body.rate },
      },
    });
    return { commissionRate: Number(profile.commissionRate) };
  }

  @Get('partner-link-requests')
  @ApiOperation({ summary: 'Partner bağlantı talepleri' })
  @ApiResponse({ status: 200 })
  async getPartnerLinkRequests(
    @Query('status') status?: PartnerLinkStatus,
  ): Promise<
    Array<
      PartnerLinkRequest & {
        clientOrg: { id: string; name: string; slug: string };
        partnerOrg: { id: string; name: string; slug: string };
      }
    >
  > {
    return ensureArray(await this.partnerLinkService.getLinkRequests(status));
  }

  @Get('partner-link-requests/pending-count')
  @ApiOperation({ summary: 'Bekleyen partner bağlantı talebi sayısı' })
  @ApiResponse({ status: 200 })
  async getPendingPartnerLinkCount(): Promise<{ count: number }> {
    const count = await this.partnerLinkService.countPendingLinkRequests();
    return { count: ensureFiniteNumber(count, 0) };
  }

  @Post('partner-link-requests/:id/approve')
  @ApiOperation({ summary: 'Partner bağlantı talebini onayla' })
  @ApiResponse({ status: 200 })
  async approvePartnerLinkRequest(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.partnerLinkService.approveLinkRequest(id, actor.id);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorOrgId: actor.organizationId ?? actor.currentOrgId,
        impersonatedOrgId: actor.isImpersonating ? actor.currentOrgId : null,
        action: 'admin.partner_link_approve',
        resourceType: 'PartnerLinkRequest',
        resourceId: id,
        metadata: {},
      },
    });
    return { ok: true };
  }

  @Post('partner-link-requests/:id/reject')
  @ApiOperation({ summary: 'Partner bağlantı talebini reddet' })
  @ApiResponse({ status: 200 })
  async rejectPartnerLinkRequest(
    @Param('id') id: string,
    @Body() body: RejectPartnerLinkRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.partnerLinkService.rejectLinkRequest(id, actor.id, body.note);
    await this.prisma.auditLog.create({
      data: {
        actorUserId: actor.id,
        actorOrgId: actor.organizationId ?? actor.currentOrgId,
        impersonatedOrgId: actor.isImpersonating ? actor.currentOrgId : null,
        action: 'admin.partner_link_reject',
        resourceType: 'PartnerLinkRequest',
        resourceId: id,
        metadata: { note: body.note ?? null },
      },
    });
    return { ok: true };
  }

  @Get('organizations/:organizationId/audit-logs')
  @ApiOperation({ summary: 'Organizasyon denetim kayıtları (yönetici)' })
  @ApiResponse({ status: 200, description: 'Sayfalı kayıtlar' })
  @ApiResponse({ status: 404, description: 'Organizasyon bulunamadı' })
  async getOrganizationAuditLogs(
    @Param('organizationId') organizationId: string,
    @Query() query: AuditLogsQueryDto,
  ) {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı');
    }
    return this.usersService.getAuditLogsPage(organizationId, query);
  }

  @Get('organizations/:id/activity-summary')
  @ApiOperation({ summary: 'Organizasyon aktivite özeti (son 30 gün)' })
  @ApiResponse({ status: 200, description: 'Özet' })
  async getOrgActivitySummary(
    @Param('id') id: string,
  ): Promise<ActivitySummary> {
    return this.adminService.getOrgActivitySummary(id);
  }

  @Get('organizations/:id/notes')
  @ApiOperation({ summary: 'Organizasyon notları' })
  @ApiResponse({ status: 200, description: 'Not listesi' })
  async getOrgNotes(@Param('id') id: string): Promise<OrgNoteItem[]> {
    return this.adminService.getOrgNotes(id);
  }

  @Post('organizations/:id/notes')
  @ApiOperation({ summary: 'Organizasyona not ekle' })
  @ApiResponse({ status: 201, description: 'Not eklendi' })
  async addOrgNote(
    @Param('id') id: string,
    @Body() body: AddOrgNoteDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<OrgNoteItem> {
    return this.adminService.addOrgNote(id, actor.id, body.note);
  }

  @Get('organizations/:id/export')
  @Header('Content-Type', 'application/zip')
  @Header('Content-Disposition', 'attachment; filename="org-export.zip"')
  @ApiOperation({ summary: 'Organizasyon verisini ZIP olarak dışa aktar' })
  @ApiResponse({ status: 200, description: 'ZIP dosyası' })
  async exportOrganizationData(
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const zip = await this.adminService.exportOrgDataZip(id);
    res.send(zip);
  }

  @Patch('organizations/:id/info')
  @ApiOperation({ summary: 'Admin: Organizasyon temel bilgilerini güncelle' })
  async updateOrganizationInfo(
    @Param('id') id: string,
    @Body() dto: UpdateAdminOrganizationInfoDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<void> {
    return this.adminService.updateOrganizationInfo(id, dto, actor);
  }

  @Delete('organizations/:id')
  @ApiOperation({ summary: 'Organizasyonu sil (soft delete)' })
  @ApiResponse({ status: 200, description: 'Silindi' })
  async deleteOrganization(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    await this.adminService.deleteOrganization(id, actor);
    return { ok: true };
  }

  @Get('organizations/:organizationId/audit-logs/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="audit-logs.csv"')
  @ApiOperation({ summary: 'Organizasyon denetim kayıtları CSV (yönetici)' })
  @ApiResponse({ status: 200, description: 'CSV' })
  async exportOrganizationAuditLogs(
    @Param('organizationId') organizationId: string,
    @Query() query: AuditLogsQueryDto,
  ): Promise<string> {
    const org = await this.prisma.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!org) {
      throw new NotFoundException('Organizasyon bulunamadı');
    }
    if (query.format !== 'csv') {
      throw new BadRequestException('Yalnızca format=csv desteklenir');
    }
    return this.usersService.exportAuditLogsCsv(organizationId, query);
  }

  @Get('integrations')
  @ApiOperation({ summary: 'Entegrasyon listesi (API sağlığı + politika özeti)' })
  async listIntegrations(): Promise<AdminIntegrationListItem[]> {
    return this.integrationPolicy.listForAdmin();
  }

  @Get('integrations/:platformKey')
  @ApiOperation({ summary: 'Entegrasyon detayı ve düzenlenebilir alanlar' })
  async getIntegrationDetail(
    @Param('platformKey') platformKey: string,
  ): Promise<AdminIntegrationDetail> {
    const key = this.integrationPolicy.assertPlatformKey(platformKey);
    return this.integrationPolicy.getDetail(key);
  }

  @Put('integrations/:platformKey')
  @ApiOperation({ summary: 'Entegrasyon politikasını güncelle' })
  async updateIntegrationPolicy(
    @Param('platformKey') platformKey: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: UpdateIntegrationPolicyDto,
  ): Promise<AdminIntegrationDetail> {
    const key = this.integrationPolicy.assertPlatformKey(platformKey);
    const updated = await this.integrationPolicy.updatePolicy(
      key,
      dto,
      actor.id,
    );
    await this.auditService.log({
      actorUserId: actor.id,
      actorOrgId: actor.organizationId,
      action: 'admin.integration_policy_update',
      resourceType: 'IntegrationPlatformPolicy',
      resourceId: key,
      metadata: { platformKey: key },
    });
    return updated;
  }

  @Post('integrations/:platformKey/reset-circuit')
  @ApiOperation({ summary: 'Entegrasyon devre kesicisini sıfırla' })
  async resetIntegrationCircuit(
    @Param('platformKey') platformKey: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    const key = this.integrationPolicy.assertPlatformKey(platformKey);
    await this.integrationPolicy.resetCircuit(key);
    await this.auditService.log({
      actorUserId: actor.id,
      actorOrgId: actor.organizationId,
      action: 'admin.platform_circuit_reset',
      resourceType: 'PlatformHealth',
      resourceId: key,
    });
    return { ok: true };
  }

  @Get('integrations/:platformKey/activity')
  @ApiOperation({ summary: 'Platform API / senkron aktivite günlüğü' })
  async getIntegrationActivity(
    @Param('platformKey') platformKey: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    const key = this.integrationPolicy.assertPlatformKey(platformKey);
    const entries = await this.platformActivityLog.list(key, limit);
    return { data: entries };
  }

  @Post('integrations/:platformKey/clear-rate-limit')
  @ApiOperation({ summary: 'BizimHesap rate limit bekleme süresini temizle (org bazlı)' })
  async clearIntegrationRateLimit(
    @Param('platformKey') platformKey: string,
    @Query('organizationId') organizationId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ ok: true }> {
    const key = this.integrationPolicy.assertPlatformKey(platformKey);
    if (key !== 'BIZIMHESAP') {
      throw new BadRequestException('Yalnızca BizimHesap için desteklenir.');
    }
    if (!organizationId?.trim()) {
      throw new BadRequestException('organizationId zorunludur.');
    }
    await this.bizimHesapRateLimit.clearCooldown(organizationId.trim());
    await this.auditService.log({
      actorUserId: actor.id,
      actorOrgId: actor.organizationId,
      action: 'admin.bizimhesap_rate_limit_cleared',
      resourceType: 'Organization',
      resourceId: organizationId.trim(),
      metadata: { platformKey: key },
    });
    return { ok: true };
  }
}
