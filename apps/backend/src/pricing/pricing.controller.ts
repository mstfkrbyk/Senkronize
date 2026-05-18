import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
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
import { PlanTier } from '@prisma/client';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequiresPlan, SubscriptionGuard } from '../common/guards/subscription.guard';

import type { BuyBoxAnalysisResult, BuyBoxWinRateStats } from './buybox.service';
import {
  CreatePricingRuleDto,
  ManualPriceUpdateDto,
  PriceHistoryQueryDto,
  PricingPlatformQueryDto,
  SimulatePricingRuleDto,
  UpdatePricingRuleDto,
} from './pricing.dto';
import type { BuyBoxSummaryResponse, PriceHistoryItemResponse } from './pricing.service';
import { PricingService } from './pricing.service';

@ApiTags('Fiyatlandırma')
@ApiBearerAuth()
@RequiresPlan(PlanTier.PRO)
@UseGuards(JwtAuthGuard, SubscriptionGuard)
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('rules')
  @ApiOperation({ summary: 'Fiyat kuralları listesi' })
  @ApiResponse({ status: 200, description: 'Kurallar' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 402, description: 'Paket yükseltme gerekli' })
  async listRules(@CurrentOrg() org: CurrentOrgPayload) {
    return this.pricingService.findRules(org.id);
  }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Yeni fiyat kuralı' })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  @ApiResponse({ status: 402, description: 'Paket yükseltme gerekli' })
  async createRule(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CreatePricingRuleDto,
  ) {
    return this.pricingService.createRule(org.id, dto);
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: 'Fiyat kuralını güncelle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  @ApiResponse({ status: 402, description: 'Paket yükseltme gerekli' })
  async updateRule(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePricingRuleDto,
  ) {
    return this.pricingService.updateRule(org.id, id, dto);
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: 'Fiyat kuralını sil (soft-delete)' })
  @ApiResponse({ status: 200, description: 'Silindi' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  @ApiResponse({ status: 402, description: 'Paket yükseltme gerekli' })
  async deleteRule(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.pricingService.deleteRule(org.id, id);
    return { ok: true };
  }

  @Get('buybox')
  @ApiOperation({ summary: 'BuyBox özeti ve son anlık görüntüler' })
  @ApiResponse({ status: 200, description: 'Özet' })
  @ApiResponse({ status: 402, description: 'Paket yükseltme gerekli' })
  async getBuyBox(@CurrentOrg() org: CurrentOrgPayload): Promise<BuyBoxSummaryResponse> {
    return this.pricingService.getBuyBoxSummary(org.id);
  }

  @Get('buybox-analysis/:listingId')
  @ApiOperation({ summary: 'Listeleme için BuyBox analizi ve öneri' })
  @ApiResponse({ status: 200, description: 'Analiz' })
  @ApiResponse({ status: 404, description: 'Listeleme bulunamadı' })
  @ApiResponse({ status: 402, description: 'Paket yükseltme gerekli' })
  async getBuyBoxAnalysis(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('listingId') listingId: string,
  ): Promise<BuyBoxAnalysisResult> {
    return this.pricingService.getBuyBoxListingAnalysis(org.id, listingId);
  }

  @Get('win-rate')
  @ApiOperation({ summary: 'BuyBox kazanma oranı (tüm platformlar, anlık görüntü bazlı)' })
  @ApiResponse({ status: 200, description: 'İstatistikler' })
  @ApiResponse({ status: 402, description: 'Paket yükseltme gerekli' })
  async getWinRate(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ): Promise<BuyBoxWinRateStats> {
    const clamped = Math.min(Math.max(days, 1), 365);
    return this.pricingService.getBuyBoxWinRateStats(org.id, clamped);
  }

  @Post('rules/:id/simulate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kural simülasyonu (fiyat değiştirmeden öneri)' })
  @ApiResponse({ status: 200, description: 'Simülasyon sonucu' })
  @ApiResponse({ status: 404, description: 'Kural bulunamadı' })
  @ApiResponse({ status: 402, description: 'Paket yükseltme gerekli' })
  async simulateRule(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: SimulatePricingRuleDto,
  ): Promise<{ suggestedPrice: number | null; strategy: string }> {
    return this.pricingService.simulateRule(org.id, id, dto);
  }

  @Get('buybox/:barcode')
  @ApiOperation({ summary: 'Barkod için BuyBox geçmişi (son 30 gün)' })
  @ApiResponse({ status: 200, description: 'Anlık görüntüler' })
  @ApiResponse({ status: 402, description: 'Paket yükseltme gerekli' })
  async getBuyBoxForBarcode(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('barcode') barcode: string,
    @Query() query: PricingPlatformQueryDto,
  ) {
    return this.pricingService.getSnapshotsForBarcode(
      org.id,
      barcode,
      query.platform,
    );
  }

  @Post('run')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Aktif kuralları kuyrukta çalıştır' })
  @ApiResponse({ status: 201, description: 'İş kuyruğa eklendi' })
  @ApiResponse({ status: 402, description: 'Paket yükseltme gerekli' })
  async runRules(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ jobId: string }> {
    return this.pricingService.runRulesForOrg(org.id);
  }

  @Post('manual')
  @ApiOperation({ summary: 'Manuel fiyat güncelleme (kuyruk)' })
  @ApiResponse({ status: 200, description: 'Kuyruğa eklendi' })
  @ApiResponse({ status: 404, description: 'Listing bulunamadı' })
  @ApiResponse({ status: 402, description: 'Paket yükseltme gerekli' })
  async manual(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: ManualPriceUpdateDto,
  ): Promise<{ ok: true }> {
    await this.pricingService.manualUpdate(org.id, dto);
    return { ok: true };
  }

  @Get('history')
  @ApiOperation({ summary: 'Fiyat geçmişi (sayfalı)' })
  @ApiResponse({ status: 200, description: 'Kayıtlar' })
  @ApiResponse({ status: 402, description: 'Paket yükseltme gerekli' })
  async history(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: PriceHistoryQueryDto,
  ): Promise<{ items: PriceHistoryItemResponse[]; total: number }> {
    return this.pricingService.findPriceHistory(org.id, query);
  }

  @Get('history/:barcode')
  @ApiOperation({ summary: 'Barkoda göre fiyat geçmişi' })
  @ApiResponse({ status: 200, description: 'Kayıtlar' })
  @ApiResponse({ status: 402, description: 'Paket yükseltme gerekli' })
  async historyByBarcode(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('barcode') barcode: string,
    @Query() query: PricingPlatformQueryDto,
  ): Promise<PriceHistoryItemResponse[]> {
    return this.pricingService.findPriceHistoryByBarcode(
      org.id,
      barcode,
      query.platform,
    );
  }
}
