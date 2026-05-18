import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  DateRangeReportQueryDto,
  OrderTrendQueryDto,
  PlatformReportQueryDto,
  ProductsReportQueryDto,
  ProfitReportQueryDto,
  SalesReportQueryDto,
  StockMovementQueryDto,
} from './reports.dto';
import { ReportsService } from './reports.service';
import type {
  DashboardSummaryDto,
  OrderTrendDto,
  PlatformComparisonDto,
  PlatformReportRow,
  ProfitReportDto,
  SalesReportRow,
  StockMovementRow,
  StockValueReportDto,
  TopProductRow,
} from './reports.types';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard-summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Panel özet KPI' })
  @ApiResponse({ status: 200, description: 'Özet metrikler' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async getDashboardSummary(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<DashboardSummaryDto> {
    return this.reportsService.getDashboardSummary(org.id);
  }

  @Get('sales')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Satış özeti (günlük / haftalık / aylık)' })
  @ApiResponse({ status: 200, description: 'Rapor satırları' })
  async getSales(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: SalesReportQueryDto,
  ): Promise<SalesReportRow[]> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);
    return this.reportsService.getSalesReport(
      org.id,
      startDate,
      endDate,
      query.groupBy ?? 'day',
    );
  }

  @Get('platform')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Platform bazlı sipariş dağılımı' })
  @ApiResponse({ status: 200, description: 'Platform satırları' })
  async getPlatform(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: PlatformReportQueryDto,
  ): Promise<PlatformReportRow[]> {
    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    endDate.setHours(23, 59, 59, 999);
    return this.reportsService.getPlatformReport(org.id, startDate, endDate);
  }

  @Get('products')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'En çok satan ürünler (barkod)' })
  @ApiResponse({ status: 200, description: 'Ürün satırları' })
  async getProducts(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: ProductsReportQueryDto,
  ): Promise<TopProductRow[]> {
    const limit = query.limit ?? 20;
    let start: Date | undefined;
    let end: Date | undefined;
    if (query.startDate && query.endDate) {
      start = new Date(query.startDate);
      end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
    }
    return this.reportsService.getTopProducts(org.id, limit, start, end);
  }

  @Get('stock-movement')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stok hareket özeti (stok kayıtları)' })
  @ApiResponse({ status: 200, description: 'Stok satırları' })
  async getStockMovement(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: StockMovementQueryDto,
  ): Promise<StockMovementRow[]> {
    const limit = query.limit ?? 100;
    let start: Date | undefined;
    let end: Date | undefined;
    if (query.startDate) {
      start = new Date(query.startDate);
    }
    if (query.endDate) {
      end = new Date(query.endDate);
      end.setHours(23, 59, 59, 999);
    }
    return this.reportsService.getStockMovementReport(
      org.id,
      limit,
      start,
      end,
    );
  }

  @Get('profit')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Kâr analizi (tahmini kâr ve platform dağılımı)' })
  @ApiResponse({ status: 200, description: 'Kâr raporu' })
  async getProfitReport(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: ProfitReportQueryDto,
  ): Promise<ProfitReportDto> {
    const from = new Date(query.startDate);
    const to = new Date(query.endDate);
    to.setHours(23, 59, 59, 999);
    return this.reportsService.getProfitReport(org.id, {
      from,
      to,
      platform: query.platform,
    });
  }

  @Get('stock-value')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stok değeri özeti (listing satış fiyatı × adet)' })
  @ApiResponse({ status: 200, description: 'Stok değeri raporu' })
  async getStockValueReport(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<StockValueReportDto> {
    return this.reportsService.getStockValueReport(org.id);
  }

  @Get('order-trend')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş ve gelir trendi (günlük / haftalık / aylık)' })
  @ApiResponse({ status: 200, description: 'Zaman serisi' })
  async getOrderTrend(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: OrderTrendQueryDto,
  ): Promise<OrderTrendDto> {
    const from = new Date(query.startDate);
    const to = new Date(query.endDate);
    to.setHours(23, 59, 59, 999);
    return this.reportsService.getOrderTrend(org.id, {
      granularity: query.granularity,
      from,
      to,
    });
  }

  @Get('platform-comparison')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Platform performans karşılaştırması' })
  @ApiResponse({ status: 200, description: 'Platform satırları' })
  async getPlatformComparison(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: DateRangeReportQueryDto,
  ): Promise<PlatformComparisonDto> {
    const from = new Date(query.startDate);
    const to = new Date(query.endDate);
    to.setHours(23, 59, 59, 999);
    return this.reportsService.getPlatformComparison(org.id, { from, to });
  }
}
