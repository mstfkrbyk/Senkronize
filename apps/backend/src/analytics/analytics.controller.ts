import { Controller, Get, Query, StreamableFile, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { AnalyticsExportService } from './analytics-export.service';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsDaysQueryDto,
  AnalyticsExportQueryDto,
  AnalyticsPeriodQueryDto,
  TopProductsQueryDto,
} from './analytics.dto';
import type {
  AnalyticsComparisonResponse,
  AovTrendResponse,
  CustomerInsightsResponse,
  DailyRevenueTrendResponse,
  PlatformComparisonResponse,
  RevenueByHourResponse,
  TopProductsResponse,
  TopReturnedProductsResponse,
} from './analytics.types';

@ApiTags('analytics')
@ApiBearerAuth()
@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly analyticsExport: AnalyticsExportService,
  ) {}

  @Get('platform-comparison')
  @ApiOperation({ summary: 'Platform bazlı sipariş ve gelir karşılaştırması' })
  @ApiResponse({ status: 200, description: 'Platform metrikleri' })
  async getPlatformComparison(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: AnalyticsPeriodQueryDto,
  ): Promise<PlatformComparisonResponse> {
    return this.analyticsService.getPlatformComparison(org.id, query.period);
  }

  @Get('customer-insights')
  @ApiOperation({ summary: 'Müşteri segmentasyonu ve şehir dağılımı' })
  @ApiResponse({ status: 200, description: 'Müşteri analitiği' })
  async getCustomerInsights(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: AnalyticsPeriodQueryDto,
  ): Promise<CustomerInsightsResponse> {
    return this.analyticsService.getCustomerInsights(org.id, query.period);
  }

  @Get('revenue-by-hour')
  @ApiOperation({ summary: 'Saatlik gelir dağılımı' })
  @ApiResponse({ status: 200, description: 'Saatlik satış' })
  async getRevenueByHour(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: AnalyticsDaysQueryDto,
  ): Promise<RevenueByHourResponse> {
    return this.analyticsService.getRevenueByHour(org.id, query.days);
  }

  @Get('top-products')
  @ApiOperation({ summary: 'En çok satan ürünler' })
  @ApiResponse({ status: 200, description: 'Ürün sıralaması' })
  async getTopProducts(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: TopProductsQueryDto,
  ): Promise<TopProductsResponse> {
    return this.analyticsService.getTopProducts(
      org.id,
      query.period,
      query.limit,
    );
  }

  @Get('top-returned-products')
  @ApiOperation({ summary: 'En çok iade edilen ürünler' })
  @ApiResponse({ status: 200, description: 'İade sıralaması' })
  async getTopReturnedProducts(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: TopProductsQueryDto,
  ): Promise<TopReturnedProductsResponse> {
    return this.analyticsService.getTopReturnedProducts(
      org.id,
      query.period,
      query.limit,
    );
  }

  @Get('aov-trend')
  @ApiOperation({ summary: 'Ortalama sepet değeri (AOV) trendi' })
  @ApiResponse({ status: 200, description: 'AOV zaman serisi' })
  async getAovTrend(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: AnalyticsDaysQueryDto,
  ): Promise<AovTrendResponse> {
    return this.analyticsService.getAovTrend(org.id, query.days);
  }

  @Get('daily-revenue-trend')
  @ApiOperation({ summary: 'Günlük gelir trendi' })
  @ApiResponse({ status: 200, description: 'Günlük gelir zaman serisi' })
  async getDailyRevenueTrend(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: AnalyticsDaysQueryDto,
  ): Promise<DailyRevenueTrendResponse> {
    return this.analyticsService.getDailyRevenueTrend(org.id, query.days);
  }

  @Get('comparison')
  @ApiOperation({
    summary:
      'Karşılaştırmalı analitik (bu dönem / önceki dönem / geçen yıl aynı dönem)',
  })
  @ApiResponse({ status: 200, description: 'Özet, platform ve kategori karşılaştırması' })
  async getComparison(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: AnalyticsPeriodQueryDto,
  ): Promise<AnalyticsComparisonResponse> {
    return this.analyticsService.getComparison(org.id, query.period);
  }

  @Get('export')
  @ApiOperation({ summary: 'Analitik veriyi CSV veya Excel olarak dışa aktar' })
  @ApiResponse({ status: 200, description: 'Dosya indirme' })
  async exportAnalytics(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: AnalyticsExportQueryDto,
  ): Promise<StreamableFile> {
    const { buffer, filename, mime } = await this.analyticsExport.export(
      org.id,
      query.type,
      query.format,
      query.period,
    );
    return new StreamableFile(buffer, {
      type: mime,
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
