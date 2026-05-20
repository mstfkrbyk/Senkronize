import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { StockMovement } from '@prisma/client';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  BulkStockUpdateDto,
  CreateStockCountSessionDto,
  CreateStockTransferDto,
  DistributeStockDto,
  ListStockTransfersQueryDto,
  PreviewDistributionDto,
  StockAdjustDto,
  StockForecastQueryDto,
  StockHistoryQueryDto,
  StockQueryDto,
  StockSummaryQueryDto,
  UpsertStockCountItemDto,
} from './stock.dto';
import {
  StockCountService,
  type StockCountItemRowDto,
  type StockCountSessionDetailDto,
} from './stock-count.service';
import { StockDistributionService } from './stock-distribution.service';
import type {
  DistributionPreview,
  DistributionResult,
} from './stock-distribution.types';
import { StockForecastService } from './stock-forecast.service';
import type {
  ProductStockForecastResultDto,
  SeasonalityDataDto,
  StockForecastSummaryDto,
  StockoutEstimateDto,
  StockProjectionDto,
} from './stock-forecast.types';
import {
  StockMovementService,
  type DailyMovementFlowPoint,
  type MovementSummary,
} from './stock-movement.service';
import {
  StockTransferService,
  type StockTransferDetailDto,
  type StockTransferRowDto,
} from './stock-transfer.service';
import {
  StockService,
  type LowStockEntryRow,
  type SerializedStockEntry,
  type StockOverviewRow,
} from './stock.service';

const CSV_MAX_BYTES = 10 * 1024 * 1024;
const CSV_MIMES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);

@ApiTags('Stok')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly stockMovementService: StockMovementService,
    private readonly stockCountService: StockCountService,
    private readonly stockTransferService: StockTransferService,
    private readonly stockForecastService: StockForecastService,
    private readonly stockDistributionService: StockDistributionService,
  ) {}

  @Post('distribute/preview')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stok dağıtım önizlemesi' })
  @ApiResponse({ status: 200 })
  async previewDistribution(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: PreviewDistributionDto,
  ): Promise<{ data: { distribution: Record<string, number> } }> {
    const preview = await this.stockDistributionService.getCurrentDistribution(
      org.id,
      dto.barcode,
    );
    const totalStock = dto.totalStock ?? preview.totalStock;
    const distribution = await this.stockDistributionService.previewDistribution(
      org.id,
      dto.barcode,
      totalStock,
      dto.strategy,
    );
    return { data: { distribution } };
  }

  @Post('distribute')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stok dağıtım stratejisi uygula' })
  @ApiResponse({ status: 201 })
  async distributeStock(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: DistributeStockDto,
  ): Promise<{ data: DistributionResult }> {
    const preview = await this.stockDistributionService.getCurrentDistribution(
      org.id,
      dto.barcode,
    );
    const totalStock = dto.totalStock ?? preview.totalStock;
    const data = await this.stockDistributionService.distributeStock(
      org.id,
      dto.barcode,
      totalStock,
      dto.strategy,
    );
    return { data };
  }

  @Get('distribution/:barcode')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürünün mevcut platform stok dağılımı' })
  @ApiResponse({ status: 200 })
  async getDistribution(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('barcode') barcode: string,
  ): Promise<{ data: DistributionPreview }> {
    const data = await this.stockDistributionService.getCurrentDistribution(
      org.id,
      barcode,
    );
    return { data };
  }

  @Get('forecast/summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stok tahmini özet (7/14/30 gün, tahmini maliyet)' })
  @ApiResponse({ status: 200 })
  async forecastSummary(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<StockForecastSummaryDto> {
    return this.stockForecastService.getForecastSummary(org.id);
  }

  @Get('forecast/critical')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '7 günden az stok ömrü olan ürünler' })
  @ApiResponse({ status: 200 })
  async forecastCritical(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ data: StockoutEstimateDto[] }> {
    const data = await this.stockForecastService.getCriticalStockItems(org.id);
    return { data };
  }

  @Get('forecast')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürün bazlı stok tükenme tahmini listesi' })
  @ApiResponse({ status: 200 })
  async forecastBulk(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: StockForecastQueryDto,
  ): Promise<{ data: StockoutEstimateDto[] }> {
    const data = await this.stockForecastService.bulkForecast(
      org.id,
      query.maxItems,
    );
    return { data };
  }

  @Get('forecast/product/:productId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürün bazlı 30 günlük stok tahmin verisi' })
  @ApiResponse({ status: 200 })
  async forecastByProduct(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('productId') productId: string,
  ): Promise<ProductStockForecastResultDto> {
    return this.stockForecastService.getForecastData(org.id, productId);
  }

  @Get('forecast/:barcode/seasonality')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Basit sezonsallık karşılaştırması (son 30 gün vs önceki 30 gün)' })
  @ApiResponse({ status: 200 })
  async forecastSeasonality(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('barcode') barcode: string,
  ): Promise<SeasonalityDataDto> {
    return this.stockForecastService.analyzeSeasonality(org.id, barcode);
  }

  @Get('forecast/:barcode/projection')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '30 günlük stok projeksiyonu (satış hızı varsayımı)' })
  @ApiResponse({ status: 200 })
  async forecastProjection(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('barcode') barcode: string,
  ): Promise<StockProjectionDto> {
    return this.stockForecastService.getProjection(org.id, barcode);
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürün bazlı stok özeti (depo ve platform dağılımı)' })
  @ApiResponse({ status: 200 })
  async overview(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ rows: StockOverviewRow[] }> {
    return this.stockService.getManagementOverview(org.id);
  }

  @Get('movements/daily')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Son N gün günlük stok giriş/çıkış özeti' })
  @ApiResponse({ status: 200 })
  async dailyMovementFlow(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ): Promise<{ data: DailyMovementFlowPoint[] }> {
    const data = await this.stockMovementService.getDailyMovementFlow(
      org.id,
      days,
    );
    return { data };
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stok hareket özeti (tarih aralığı)' })
  @ApiResponse({ status: 200 })
  async summary(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: StockSummaryQueryDto,
  ): Promise<MovementSummary> {
    const from = new Date(query.from);
    const to = new Date(query.to);
    return this.stockMovementService.getMovementSummary(org.id, from, to);
  }

  @Get('history/:barcode')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Barkoda göre hareket geçmişi' })
  @ApiResponse({ status: 200 })
  async historyByBarcode(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('barcode') barcode: string,
    @Query() query: StockHistoryQueryDto,
  ): Promise<{ data: StockMovement[] }> {
    const data = await this.stockMovementService.getHistory(org.id, barcode, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      movementType: query.movementType,
      platform: query.platform,
      limit: query.limit,
    });
    return { data };
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Organizasyon stok hareketleri (sayfalı)' })
  @ApiResponse({ status: 200 })
  async history(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: StockHistoryQueryDto,
  ): Promise<{ data: StockMovement[]; total: number }> {
    const movementTypes = query.movementTypes
      ?.split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0) as StockMovementType[] | undefined;

    return this.stockMovementService.getOrgHistory(org.id, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      movementType: query.movementType,
      movementTypes:
        movementTypes && movementTypes.length > 0 ? movementTypes : undefined,
      barcode: query.barcode,
      platform: query.platform,
      warehouseId: query.warehouseId,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post('adjust')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Manuel stok düzeltmesi (ana depo, merkezi stok)' })
  @ApiResponse({ status: 201 })
  async adjust(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: StockAdjustDto,
  ): Promise<{ success: true }> {
    await this.stockMovementService.adjustStock(
      org.id,
      dto.barcode,
      dto.newQuantity,
      dto.note,
    );
    return { success: true };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stok kayıtları' })
  @ApiResponse({ status: 200, description: 'Liste' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async findAll(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: StockQueryDto,
  ): Promise<{ items: SerializedStockEntry[]; total: number }> {
    return this.stockService.findAll(org.id, query);
  }

  @Get('low-stock')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Düşük stok uyarısı' })
  @ApiResponse({ status: 200, description: 'Liste' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async getLowStock(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query('threshold', new DefaultValuePipe(10), ParseIntPipe)
    threshold: number,
  ): Promise<LowStockEntryRow[]> {
    return this.stockService.getLowStock(org.id, threshold);
  }

  @Post('bulk-update')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Toplu stok güncelleme (kuyruk)' })
  @ApiResponse({ status: 201, description: 'İşler eklendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async bulkUpdate(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkStockUpdateDto,
  ): Promise<{ jobIds: string[] }> {
    return this.stockService.bulkUpdate(org.id, dto);
  }

  @Post('count-sessions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Yeni stok sayım oturumu başlat' })
  @ApiResponse({ status: 201 })
  async createStockCountSession(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStockCountSessionDto,
  ): Promise<{ data: { id: string } }> {
    return this.stockCountService.createSession(org.id, user.id, dto);
  }

  @Get('count-sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stok sayım oturumu detayı' })
  @ApiResponse({ status: 200 })
  async getStockCountSession(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: StockCountSessionDetailDto }> {
    return this.stockCountService.getSession(org.id, id);
  }

  @Post('count-sessions/:id/items')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sayım kalemi ekle veya güncelle' })
  @ApiResponse({ status: 200 })
  async upsertStockCountItem(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpsertStockCountItemDto,
  ): Promise<{ data: StockCountItemRowDto }> {
    return this.stockCountService.upsertItem(org.id, id, dto);
  }

  @Post('count-sessions/:id/apply')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sayım farklarını merkezi stoğa uygula' })
  @ApiResponse({ status: 200 })
  async applyStockCountSession(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ success: true; applied: number }> {
    return this.stockCountService.applySession(org.id, id);
  }

  @Post('count-sessions/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stok sayım oturumunu iptal et' })
  @ApiResponse({ status: 200 })
  async cancelStockCountSession(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    return this.stockCountService.cancelSession(org.id, id);
  }

  @Get('count-sessions/:id/export-pdf')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sayım formu PDF indir (barkod/QR)' })
  @ApiResponse({ status: 200 })
  async exportStockCountSheet(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const buffer = await this.stockCountService.exportCountSheet(org.id, id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="sayim-${id.slice(0, 8)}.pdf"`,
    });
  }

  @Post('count-sessions/:id/import-csv')
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'CSV ile sayım sonuçlarını yükle' })
  @ApiResponse({ status: 200 })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CSV_MAX_BYTES },
    }),
  )
  async importStockCountResult(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ data: { imported: number; skipped: number } }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('CSV dosyası gerekli.');
    }
    const mime = file.mimetype?.toLowerCase() ?? '';
    if (mime.length > 0 && !CSV_MIMES.has(mime)) {
      throw new BadRequestException('Yalnızca CSV dosyası yüklenebilir.');
    }
    return this.stockCountService.importCountResult(org.id, id, file.buffer);
  }

  @Get('transfers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stok transfer listesi' })
  @ApiResponse({ status: 200 })
  async listTransfers(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: ListStockTransfersQueryDto,
  ): Promise<{ data: StockTransferRowDto[]; total: number }> {
    return this.stockTransferService.listTransfers(org.id, query);
  }

  @Get('transfers/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stok transfer detayı' })
  @ApiResponse({ status: 200 })
  async getTransfer(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: StockTransferDetailDto }> {
    return this.stockTransferService.getTransfer(org.id, id);
  }

  @Post('transfers')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Yeni stok transferi oluştur' })
  @ApiResponse({ status: 201 })
  async createTransfer(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateStockTransferDto,
  ): Promise<{ data: StockTransferDetailDto }> {
    return this.stockTransferService.createTransfer(org.id, user.id, dto);
  }

  @Patch('transfers/:id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Transferi onayla ve stok hareketi oluştur' })
  @ApiResponse({ status: 200 })
  async confirmTransfer(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: StockTransferDetailDto }> {
    return this.stockTransferService.confirmTransfer(org.id, id);
  }

  @Patch('transfers/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Transferi iptal et' })
  @ApiResponse({ status: 200 })
  async cancelTransfer(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: StockTransferDetailDto }> {
    return this.stockTransferService.cancelTransfer(org.id, id);
  }
}
