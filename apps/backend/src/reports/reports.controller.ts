import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  ExportFormatQueryDto,
  RunReportBodyDto,
  SaveReportBodyDto,
  UpdateScheduleBodyDto,
} from './custom-report.dto';
import { CustomReportService } from './custom-report.service';
import type { ReportConfig, ReportResult, SavedReportListItem } from './custom-report.types';
import {
  DashboardSummaryQueryDto,
  DateRangeReportQueryDto,
  OrderTrendQueryDto,
  PlatformReportQueryDto,
  ProductsReportQueryDto,
  ProfitReportQueryDto,
  SalesReportQueryDto,
  StockMovementQueryDto,
  VatReportExportQueryDto,
  VatReportQueryDto,
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
import { TaxReportService } from './tax-report.service';
import type { VatReport } from './tax-report.types';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly customReportService: CustomReportService,
    private readonly taxReportService: TaxReportService,
  ) {}

  @Get('dashboard-summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Panel özet KPI' })
  @ApiResponse({ status: 200, description: 'Özet metrikler' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async getDashboardSummary(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: DashboardSummaryQueryDto,
  ): Promise<DashboardSummaryDto> {
    return this.reportsService.getDashboardSummary(org.id, query.period);
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

  @Get('vat/export')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Aylık KDV raporu CSV (e-Arşiv yardımcı dışa aktarım)' })
  @ApiResponse({ status: 200, description: 'CSV dosyası' })
  async exportVatReport(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: VatReportExportQueryDto,
  ): Promise<StreamableFile> {
    const csv = await this.taxReportService.exportVatReportCsv(
      org.id,
      query.year,
      query.month,
    );
    const buf = Buffer.from(csv, 'utf-8');
    const monthPart = String(query.month).padStart(2, '0');
    return new StreamableFile(buf, {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="kdv-raporu-${query.year}-${monthPart}.csv"`,
    });
  }

  @Get('vat')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Aylık KDV özeti (platform ve oran kırılımı)' })
  @ApiResponse({ status: 200, description: 'KDV raporu' })
  async getVatReport(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: VatReportQueryDto,
  ): Promise<VatReport> {
    return this.taxReportService.generateVatReport(org.id, query.year, query.month);
  }

  @Post('run')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Özel rapor yapılandırması ile anlık çalıştır' })
  @ApiResponse({ status: 200, description: 'Rapor sonucu' })
  @ApiResponse({ status: 400, description: 'Geçersiz yapılandırma' })
  async runCustomReport(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() body: RunReportBodyDto,
  ): Promise<ReportResult> {
    return this.customReportService.runReport(
      org.id,
      body.config as unknown as ReportConfig,
      { preview: body.preview === true },
    );
  }

  @Get('saved')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Kayıtlı özel raporlar' })
  async listSavedReports(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<SavedReportListItem[]> {
    return this.customReportService.listSavedReports(org.id);
  }

  @Post('saved')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Özel raporu kaydet' })
  async saveReport(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: SaveReportBodyDto,
  ): Promise<SavedReportListItem> {
    return this.customReportService.saveReport(org.id, user.id, body);
  }

  @Delete('saved/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Kayıtlı raporu sil' })
  @ApiResponse({ status: 200, description: 'Silindi' })
  async deleteSavedReport(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.customReportService.deleteSavedReport(org.id, id);
    return { ok: true };
  }

  @Patch('saved/:id/schedule')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Kayıtlı rapor zamanlaması (e-posta boşsa kaldırılır)' })
  async updateSavedReportSchedule(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() body: UpdateScheduleBodyDto,
  ): Promise<SavedReportListItem> {
    return this.customReportService.updateSchedule(org.id, id, body);
  }

  @Get('saved/:id/export')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Kayıtlı raporu CSV veya JSON indir' })
  async exportSavedReport(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Query() query: ExportFormatQueryDto,
  ): Promise<StreamableFile> {
    const content = await this.customReportService.exportReport(org.id, id, query.format);
    const buf = Buffer.from(content, 'utf-8');
    const mime =
      query.format === 'csv'
        ? 'text/csv; charset=utf-8'
        : 'application/json; charset=utf-8';
    return new StreamableFile(buf, {
      type: mime,
      disposition: `attachment; filename="rapor.${query.format}"`,
    });
  }

  @Post('saved/:id/run')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Kayıtlı raporu sunucuda çalıştır' })
  async runSavedReport(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<ReportResult> {
    return this.customReportService.runSavedReport(org.id, id);
  }
}
