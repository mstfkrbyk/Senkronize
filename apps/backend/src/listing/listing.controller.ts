import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtOrApiKeyGuard } from '../api-key/jwt-or-api-key.guard';

import {
  BulkUpdateDto,
  ListingQueryDto,
  RetrySyncJobDto,
  UpdatePriceDto,
  UpdateStockDto,
} from './listing.dto';
import {
  ListingService,
  type ListingSummaryDto,
  type SerializedListing,
} from './listing.service';

@ApiTags('listings')
@ApiBearerAuth()
@Controller('listings')
export class ListingController {
  constructor(private readonly listingService: ListingService) {}

  @Get()
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Listeleme listesi' })
  @ApiResponse({ status: 200, description: 'Sayfalı liste' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async findAll(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: ListingQueryDto,
  ): Promise<{ items: SerializedListing[]; total: number }> {
    return this.listingService.findAll(org.id, query);
  }

  @Get('summary')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Listeleme özeti' })
  @ApiResponse({ status: 200, description: 'Özet' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async getSummary(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<ListingSummaryDto> {
    return this.listingService.getSummary(org.id);
  }

  @Get(':id')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Listeleme detayı' })
  @ApiResponse({ status: 200, description: 'Detay' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async findOne(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<SerializedListing> {
    return this.listingService.findOne(org.id, id);
  }

  @Post('sync')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Pazaryeri listelemelerini kuyruğa senkronize et' })
  @ApiResponse({ status: 201, description: 'İşler kuyruğa eklendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async triggerSync(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ jobIds: string[]; message: string }> {
    const { jobIds } = await this.listingService.triggerSync(org.id);
    return {
      jobIds,
      message:
        jobIds.length === 0
          ? 'Aktif pazaryeri bağlantısı yok; kuyruğa iş eklenmedi.'
          : 'Senkronizasyon işleri kuyruğa eklendi.',
    };
  }

  @Post('retry-job')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Başarısız kuyruk işini denetim kaydından yeniden kuyruğa al' })
  @ApiResponse({ status: 201, description: 'İş yeniden kuyruğa eklendi' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async retryFailedJob(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: RetrySyncJobDto,
  ): Promise<{ jobId: string }> {
    return this.listingService.retryFromAuditLog(org.id, dto.auditLogId);
  }

  @Post('bulk-update')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Toplu stok ve fiyat güncelleme (barkod bazlı)' })
  @ApiResponse({ status: 200, description: 'Güncellenen listeleme sayısı' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async bulkUpdate(
    @Body() dto: BulkUpdateDto,
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ updated: number }> {
    return this.listingService.bulkUpdateStockAndPrice(org.id, dto.items);
  }

  @Patch(':id/price')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Listeleme fiyatını güncelle (kuyruk + optimistik DB)' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async updatePrice(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePriceDto,
  ): Promise<{ ok: true }> {
    await this.listingService.updatePrice(
      org.id,
      id,
      dto.salePrice,
      dto.listPrice,
    );
    return { ok: true };
  }

  @Patch(':id/stock')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Listeleme stokunu güncelle (kuyruk + optimistik DB)' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async updateStock(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdateStockDto,
  ): Promise<{ ok: true }> {
    await this.listingService.updateStock(org.id, id, dto.quantity);
    return { ok: true };
  }
}
