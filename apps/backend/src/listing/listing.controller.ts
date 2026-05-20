import {
  Body,
  Controller,
  Delete,
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
import { Throttle } from '@nestjs/throttler';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtOrApiKeyGuard } from '../api-key/jwt-or-api-key.guard';

import {
  BulkPriceItemDto,
  BulkPushDto,
  BulkStatusDto,
  BulkStockItemDto,
  BulkUpdateDto,
  ListingQueryDto,
  RetrySyncJobDto,
  UpdatePriceDto,
  UpdateStockDto,
} from './listing.dto';
import {
  ListingService,
  type ListingDetailResponse,
  type ListingSummaryDto,
  type SerializedListing,
} from './listing.service';
import type { BulkResult } from './listing.types';

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

  @Get(':id/detail')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Listeleme detay (fiyat geçmişi, BuyBox)' })
  @ApiResponse({ status: 200, description: 'Detay' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async getDetail(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<ListingDetailResponse> {
    return this.listingService.getListingDetail(org.id, id);
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
  @Throttle({ default: { limit: 10 } })
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

  @Post('bulk/status')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Toplu durum güncelleme' })
  @ApiResponse({ status: 200, description: 'Toplu işlem sonucu' })
  async bulkUpdateStatus(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkStatusDto,
  ): Promise<BulkResult> {
    return this.listingService.bulkUpdateStatus(org.id, dto.ids, dto.status);
  }

  @Post('bulk/price')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Toplu fiyat güncelleme' })
  @ApiResponse({ status: 200, description: 'Toplu işlem sonucu' })
  async bulkUpdatePrice(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() updates: BulkPriceItemDto[],
  ): Promise<BulkResult> {
    return this.listingService.bulkUpdatePrice(org.id, updates);
  }

  @Post('bulk/stock')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Toplu stok güncelleme' })
  @ApiResponse({ status: 200, description: 'Toplu işlem sonucu' })
  async bulkUpdateStock(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() updates: BulkStockItemDto[],
  ): Promise<BulkResult> {
    return this.listingService.bulkUpdateStock(org.id, updates);
  }

  @Post('bulk/push')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Seçili listelemeleri platforma gönder' })
  @ApiResponse({ status: 200, description: 'Toplu işlem sonucu' })
  async bulkPush(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkPushDto,
  ): Promise<BulkResult> {
    return this.listingService.bulkPushToPlatform(org.id, dto.ids);
  }

  @Patch(':id/toggle-active')
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Listelemeyi aktifleştir / devre dışı bırak' })
  @ApiResponse({ status: 200, description: 'Güncellenmiş listeleme' })
  async toggleActive(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<SerializedListing> {
    return this.listingService.toggleListingActive(org.id, id);
  }

  @Post(':id/sync')
  @Throttle({ default: { limit: 10 } })
  @UseGuards(JwtOrApiKeyGuard)
  @ApiOperation({ summary: 'Tek listeleme senkronizasyonu' })
  @ApiResponse({ status: 201, description: 'İşler kuyruğa eklendi' })
  async syncOne(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ jobIds: string[]; message: string }> {
    const { jobIds } = await this.listingService.syncListing(org.id, id);
    return {
      jobIds,
      message: 'Senkronizasyon işleri kuyruğa eklendi.',
    };
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

  @Delete(':id')
  @UseGuards(JwtOrApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Listelemeyi pasifleştir (soft delete)' })
  @ApiResponse({ status: 200, description: 'Silindi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async remove(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.listingService.softDelete(org.id, id);
    return { ok: true };
  }
}
