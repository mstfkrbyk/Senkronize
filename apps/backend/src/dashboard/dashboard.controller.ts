import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
  DashboardSummaryQueryDto,
} from './dashboard.dto';
import type {
  DashboardActivityItem,
  DashboardOrdersTrendResponse,
  DashboardPlatformDistributionResponse,
  DashboardSummaryResponse,
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
  @ApiOperation({ summary: 'Son dashboard aktiviteleri (denetim kaydı)' })
  @ApiResponse({ status: 200, description: 'Aktivite listesi' })
  async getActivity(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: DashboardActivityQueryDto,
  ): Promise<DashboardActivityItem[]> {
    return this.dashboardService.getActivity(org.id, query.limit ?? 10);
  }
}
