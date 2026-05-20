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
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  ExportFormatQueryDto,
  MetricsReportBodyDto,
  RunReportBodyDto,
  SaveReportBodyDto,
  ScheduleCustomReportBodyDto,
  UpdateScheduleBodyDto,
} from './custom-report.dto';
import { CustomReportService } from './custom-report.service';
import type {
  MetricsReportResult,
  ReportConfig,
  ReportResult,
  ScheduledCustomReportItem,
  SavedReportListItem,
} from './custom-report.types';
import { ProfitReportService } from './profit-report.service';
import type { ProfitBreakdownReportDto } from './profit-report.types';
import {
  CreateReportScheduleDto,
  DashboardSummaryQueryDto,
  DateRangeReportQueryDto,
  ELedgerQueryDto,
  OrderTrendQueryDto,
  PdfReportQueryDto,
  PlatformReportQueryDto,
  ProductsReportQueryDto,
  ProfitBreakdownQueryDto,
  ProfitReportQueryDto,
  SalesReportQueryDto,
  StockMovementQueryDto,
  TaxPeriodQueryDto,
  VatReportExportQueryDto,
  VatReportQueryDto,
} from './reports.dto';
import { ReportPdfService } from './report-pdf.service';
import { ReportScheduleService } from './report-schedule.service';
import type { ReportScheduleItem } from './report-schedule.service';
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
import type {
  BaBsReport,
  ELedgerReport,
  VatDeclarationReport,
  VatReport,
} from './tax-report.types';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly customReportService: CustomReportService,
    private readonly taxReportService: TaxReportService,
    private readonly profitReportService: ProfitReportService,
    private readonly reportPdfService: ReportPdfService,
    private readonly reportScheduleService: ReportScheduleService,
  ) {}

  @Get('pdf/sales')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Satış raporu PDF indir' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF dosyası' })
  async downloadSalesPdf(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: PdfReportQueryDto,
  ): Promise<StreamableFile> {
    const period = query.period ?? '30d';
    const buffer = await this.reportPdfService.generateSalesReport(org.id, period);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="satis-raporu-${period}.pdf"`,
    });
  }

  @Get('pdf/stock')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stok raporu PDF indir' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF dosyası' })
  async downloadStockPdf(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<StreamableFile> {
    const buffer = await this.reportPdfService.generateStockReport(org.id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: 'attachment; filename="stok-raporu.pdf"',
    });
  }

  @Get('pdf/profit')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Kâr raporu PDF indir' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF dosyası' })
  async downloadProfitPdf(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: PdfReportQueryDto,
  ): Promise<StreamableFile> {
    const period = query.period ?? '30d';
    const buffer = await this.reportPdfService.generateProfitReport(org.id, period);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="kar-raporu-${period}.pdf"`,
    });
  }

  @Get('schedules')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Standart rapor zamanlamalarını listele' })
  @ApiResponse({ status: 200, description: 'Zamanlama listesi' })
  async listReportSchedules(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<ReportScheduleItem[]> {
    return this.reportScheduleService.listSchedules(org.id);
  }

  @Get('scheduled')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Zamanlanmış özel (metrik) raporları listele' })
  @ApiResponse({ status: 200, description: 'Zamanlanmış rapor listesi' })
  async listScheduledCustomReports(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<ScheduledCustomReportItem[]> {
    return this.customReportService.listScheduledCustomReports(org.id);
  }

  @Post('schedule')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary:
      'Rapor zamanlaması (standart PDF veya özel metrik raporu — gövdeye göre)',
  })
  @ApiResponse({ status: 201, description: 'Zamanlama kaydedildi' })
  async createReportSchedule(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateReportScheduleDto | ScheduleCustomReportBodyDto,
  ): Promise<ReportScheduleItem | ScheduledCustomReportItem> {
    if ('reportKind' in body && body.reportKind) {
      return this.reportScheduleService.saveSchedule(org.id, user.id, body);
    }
    return this.customReportService.scheduleCustomReport(
      org.id,
      user.id,
      body as ScheduleCustomReportBodyDto,
    );
  }

  @Delete('scheduled/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Zamanlanmış özel rapor zamanlamasını kaldır' })
  @ApiResponse({ status: 200, description: 'Zamanlama kaldırıldı' })
  async deleteScheduledCustomReport(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.customReportService.deleteScheduledCustomReport(org.id, id);
    return { ok: true };
  }

  @Post('custom')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Metrik tabanlı özel raporu anlık çalıştır' })
  @ApiResponse({ status: 200, description: 'Metrik rapor sonucu' })
  async runMetricsCustomReport(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() body: MetricsReportBodyDto,
  ): Promise<MetricsReportResult> {
    return this.customReportService.runMetricsReport(org.id, body);
  }

  @Get('tax/vat-declaration')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Aylık KDV beyanname özeti' })
  @ApiResponse({ status: 200, description: 'KDV beyanname raporu' })
  async getVatDeclaration(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: TaxPeriodQueryDto,
  ): Promise<VatDeclarationReport> {
    return this.taxReportService.generateVatDeclaration(org.id, query.period);
  }

  @Get('tax/e-ledger')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'E-Defter yevmiye hazırlık (stub)' })
  @ApiResponse({ status: 200, description: 'E-Defter taslağı' })
  async getELedger(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: ELedgerQueryDto,
  ): Promise<ELedgerReport> {
    return this.taxReportService.generateELedger(
      org.id,
      query.period,
      query.format ?? 'json',
    );
  }

  @Get('tax/ba-bs')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ba/Bs formu hazırlık verisi' })
  @ApiResponse({ status: 200, description: 'Ba/Bs raporu' })
  async getBaBs(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: TaxPeriodQueryDto,
  ): Promise<BaBsReport> {
    return this.taxReportService.generateBaBs(org.id, query.period);
  }

  @Get('profit/by-platform')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Platform bazlı net gelir ve kâr kırılımı' })
  @ApiResponse({ status: 200, description: 'Platform kâr raporu' })
  async getProfitByPlatform(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: ProfitBreakdownQueryDto,
  ): Promise<ProfitBreakdownReportDto> {
    return this.profitReportService.getByPlatform(
      org.id,
      query.period ?? '30d',
    );
  }

  @Get('profit/by-product')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürün bazlı brüt kâr' })
  @ApiResponse({ status: 200, description: 'Ürün kâr raporu' })
  async getProfitByProduct(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: ProfitBreakdownQueryDto,
  ): Promise<ProfitBreakdownReportDto> {
    return this.profitReportService.getByProduct(
      org.id,
      query.period ?? '30d',
      query.limit ?? 50,
    );
  }

  @Get('profit/by-category')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Kategori bazlı kârlılık' })
  @ApiResponse({ status: 200, description: 'Kategori kâr raporu' })
  async getProfitByCategory(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: ProfitBreakdownQueryDto,
  ): Promise<ProfitBreakdownReportDto> {
    return this.profitReportService.getByCategory(
      org.id,
      query.period ?? '30d',
    );
  }

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
