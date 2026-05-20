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
import { PlanTier } from '@prisma/client';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { Permission } from '../auth/permissions';
import { RequiresPermission } from '../auth/requires-permission.decorator';
import { RequiresPlan, SubscriptionGuard } from '../common/guards/subscription.guard';

import {
  AnalyzeCampaignDto,
  BulkCampaignStatusDto,
  CampaignFilterQueryDto,
  CreateCampaignDto,
  UpdateCampaignDto,
  ValidateCouponDto,
} from './campaign.dto';
import { CampaignService } from './campaign.service';
import type {
  CampaignDetail,
  CampaignIdImpact,
  CampaignImpact,
  CampaignKpiSummary,
  CampaignListItem,
  CampaignPerformance,
  CouponValidationResult,
} from './campaign.types';

@ApiTags('campaigns')
@ApiBearerAuth()
@RequiresPlan(PlanTier.PRO)
@UseGuards(JwtAuthGuard, SubscriptionGuard, PermissionGuard)
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @RequiresPermission(Permission.PRICING_EDIT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Kampanya oluştur' })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  async create(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CreateCampaignDto,
  ): Promise<{ data: CampaignListItem }> {
    const data = await this.campaignService.createCampaign(org.id, dto);
    return { data };
  }

  @Get()
  @RequiresPermission(Permission.PRICING_VIEW)
  @ApiOperation({ summary: 'Kampanya listesi' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async list(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: CampaignFilterQueryDto,
  ): Promise<{ data: CampaignListItem[] }> {
    const data = await this.campaignService.listCampaigns(org.id, {
      status: query.status,
    });
    return { data };
  }

  @Get('kpis/summary')
  @RequiresPermission(Permission.PRICING_VIEW)
  @ApiOperation({ summary: 'Kampanya KPI özeti' })
  @ApiResponse({ status: 200, description: 'KPI özeti' })
  async kpis(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ data: CampaignKpiSummary }> {
    const data = await this.campaignService.getKpiSummary(org.id);
    return { data };
  }

  @Post('validate-coupon')
  @RequiresPermission(Permission.PRICING_VIEW)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kupon kodu doğrula' })
  @ApiResponse({ status: 200, description: 'Doğrulama sonucu' })
  async validateCoupon(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: ValidateCouponDto,
  ): Promise<{ data: CouponValidationResult }> {
    const data = await this.campaignService.validateCoupon(org.id, dto);
    return { data };
  }

  @Patch('bulk/status')
  @RequiresPermission(Permission.PRICING_EDIT)
  @ApiOperation({ summary: 'Toplu kampanya durum güncelleme' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async bulkStatus(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkCampaignStatusDto,
  ): Promise<{ data: { updated: number; failed: string[] } }> {
    const data = await this.campaignService.bulkUpdateStatus(org.id, dto);
    return { data };
  }

  @Post('analyze')
  @RequiresPermission(Permission.PRICING_VIEW)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kampanya etki analizi' })
  @ApiResponse({ status: 200, description: 'Analiz sonucu' })
  async analyze(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: AnalyzeCampaignDto,
  ): Promise<{ data: CampaignImpact }> {
    const data = await this.campaignService.analyzeImpact(org.id, dto);
    return { data };
  }

  @Get(':id/impact')
  @RequiresPermission(Permission.PRICING_VIEW)
  @ApiOperation({ summary: 'Kampanya etki analizi' })
  @ApiResponse({ status: 200, description: 'Etki analizi' })
  async impact(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: CampaignIdImpact }> {
    const data = await this.campaignService.getCampaignImpactById(org.id, id);
    return { data };
  }

  @Get(':id/performance')
  @RequiresPermission(Permission.PRICING_VIEW)
  @ApiOperation({ summary: 'Kampanya performans metrikleri' })
  @ApiResponse({ status: 200, description: 'Performans' })
  async performance(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: CampaignPerformance }> {
    const data = await this.campaignService.getCampaignPerformance(org.id, id);
    return { data };
  }

  @Post(':id/duplicate')
  @RequiresPermission(Permission.PRICING_EDIT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Kampanyayı kopyala' })
  @ApiResponse({ status: 201, description: 'Kopyalandı' })
  async duplicate(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: CampaignListItem }> {
    const data = await this.campaignService.duplicateCampaign(org.id, id);
    return { data };
  }

  @Get(':id')
  @RequiresPermission(Permission.PRICING_VIEW)
  @ApiOperation({ summary: 'Kampanya detayı' })
  @ApiResponse({ status: 200, description: 'Detay' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async getOne(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: CampaignDetail }> {
    const data = await this.campaignService.getCampaign(org.id, id);
    return { data };
  }

  @Patch(':id')
  @RequiresPermission(Permission.PRICING_EDIT)
  @ApiOperation({ summary: 'Kampanya güncelle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async update(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ): Promise<{ data: CampaignListItem }> {
    const data = await this.campaignService.updateCampaign(org.id, id, dto);
    return { data };
  }

  @Delete(':id')
  @RequiresPermission(Permission.PRICING_EDIT)
  @ApiOperation({ summary: 'Kampanya sil' })
  @ApiResponse({ status: 200, description: 'Silindi' })
  async remove(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.campaignService.deleteCampaign(org.id, id);
    return { success: true };
  }

  @Post(':id/activate')
  @RequiresPermission(Permission.PRICING_EDIT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kampanyayı aktifleştir' })
  @ApiResponse({ status: 200, description: 'Aktifleştirildi' })
  async activate(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.campaignService.activateCampaign(org.id, id);
    return { success: true };
  }

  @Post(':id/pause')
  @RequiresPermission(Permission.PRICING_EDIT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kampanyayı duraklat' })
  @ApiResponse({ status: 200, description: 'Duraklatıldı' })
  async pause(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.campaignService.pauseCampaign(org.id, id);
    return { success: true };
  }

  @Post(':id/deactivate')
  @RequiresPermission(Permission.PRICING_EDIT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kampanyayı sonlandır' })
  @ApiResponse({ status: 200, description: 'Sonlandırıldı' })
  async deactivate(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.campaignService.deactivateCampaign(org.id, id);
    return { success: true };
  }
}
