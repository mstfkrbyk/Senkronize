import { Body, Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { DashboardService } from './dashboard.service';
import {
  DashboardActivityQueryDto,
  DashboardOrdersTrendQueryDto,
  DashboardPeriodQueryDto,
  DashboardRevenueTrendQueryDto,
  DashboardSummaryQueryDto,
  DashboardTopProductsQueryDto,
  UpdateDashboardWidgetsDto,
} from './dashboard.dto';
import type {
  DashboardActivityFeedItem,
  DashboardActivityItem,
  DashboardKpisResponse,
  DashboardOrdersTrendResponse,
  DashboardPlatformDistributionResponse,
  DashboardPlatformPerformanceRow,
  DashboardRevenueTrendPoint,
  DashboardSummaryResponse,
  DashboardTopProductRow,
  DashboardWidgetsResponse,
} from './dashboard.types';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Panel dashboard KPI özeti' })
  @ApiResponse({ status: 200, description: 'KPI metrikleri' })
  async getSummary(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: DashboardSummaryQueryDto,
  ): Promise<DashboardSummaryResponse> {
    return this.dashboardService.getSummary(org.id, query.period);
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Ana KPI metrikleri (dönem karşılaştırmalı)' })
  @ApiResponse({ status: 200, description: 'Gelir, sipariş, AOV, listeleme KPI' })
  async getKpis(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: DashboardPeriodQueryDto,
  ): Promise<DashboardKpisResponse> {
    return this.dashboardService.getKpis(org.id, query.resolvePeriod());
  }

  @Get('platform-performance')
  @ApiOperation({ summary: 'Platform bazlı performans (gelir payı)' })
  @ApiResponse({ status: 200, description: 'Platform performans satırları' })
  async getPlatformPerformance(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: DashboardPeriodQueryDto,
  ): Promise<DashboardPlatformPerformanceRow[]> {
    return this.dashboardService.getPlatformPerformance(
      org.id,
      query.resolvePeriod(),
    );
  }

  @Get('revenue-trend')
  @ApiOperation({ summary: 'Gelir ve sipariş trendi' })
  @ApiResponse({ status: 200, description: 'Zaman serisi' })
  async getRevenueTrend(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: DashboardRevenueTrendQueryDto,
  ): Promise<DashboardRevenueTrendPoint[]> {
    return this.dashboardService.getRevenueTrend(
      org.id,
      query.resolvePeriod(),
      query.groupBy ?? 'day',
    );
  }

  @Get('top-products')
  @ApiOperation({ summary: 'En iyi satan ürünler' })
  @ApiResponse({ status: 200, description: 'Ürün sıralaması' })
  async getTopProducts(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: DashboardTopProductsQueryDto,
  ): Promise<DashboardTopProductRow[]> {
    return this.dashboardService.getTopProducts(
      org.id,
      query.resolvePeriod(),
      query.limit ?? 10,
    );
  }

  @Get('orders-trend')
  @ApiOperation({ summary: 'Günlük sipariş ve gelir trendi' })
  @ApiResponse({ status: 200, description: 'Zaman serisi' })
  async getOrdersTrend(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: DashboardOrdersTrendQueryDto,
  ): Promise<DashboardOrdersTrendResponse> {
    return this.dashboardService.getOrdersTrend(org.id, query.days ?? 7);
  }

  @Get('platform-distribution')
  @ApiOperation({ summary: 'Platform bazlı sipariş dağılımı (son 30 gün)' })
  @ApiResponse({ status: 200, description: 'Platform dilimleri' })
  async getPlatformDistribution(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<DashboardPlatformDistributionResponse> {
    return this.dashboardService.getPlatformDistribution(org.id);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Son dashboard aktiviteleri (karışık akış)' })
  @ApiResponse({ status: 200, description: 'Sipariş, stok, sync aktiviteleri' })
  async getActivity(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: DashboardActivityQueryDto,
  ): Promise<DashboardActivityFeedItem[]> {
    return this.dashboardService.getMixedActivity(org.id, query.limit ?? 20);
  }

  @Get('activity/audit')
  @ApiOperation({ summary: 'Denetim kaydı aktiviteleri' })
  @ApiResponse({ status: 200, description: 'Audit log listesi' })
  async getAuditActivity(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: DashboardActivityQueryDto,
  ): Promise<DashboardActivityItem[]> {
    return this.dashboardService.getActivity(org.id, query.limit ?? 10);
  }

  @Get('widgets')
  @ApiOperation({ summary: 'Organizasyon widget düzeni' })
  @ApiResponse({ status: 200, description: 'Widget config' })
  async getWidgets(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<DashboardWidgetsResponse> {
    return this.dashboardService.getWidgets(org.id);
  }

  @Patch('widgets')
  @ApiOperation({ summary: 'Widget düzenini güncelle' })
  @ApiResponse({ status: 200, description: 'Güncellenmiş widget config' })
  async updateWidgets(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: UpdateDashboardWidgetsDto,
  ): Promise<DashboardWidgetsResponse> {
    return this.dashboardService.updateWidgets(org.id, dto.widgets);
  }
}
