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
  PlatformReportQueryDto,
  ProductsReportQueryDto,
  SalesReportQueryDto,
  StockMovementQueryDto,
} from './reports.dto';
import { ReportsService } from './reports.service';
import type {
  PlatformReportRow,
  SalesReportRow,
  StockMovementRow,
  TopProductRow,
} from './reports.types';

@ApiTags('Raporlar')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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
}
