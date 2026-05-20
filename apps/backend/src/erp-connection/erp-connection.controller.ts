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
  Put,
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
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';

import { ConnectionHealthService } from '../connection-health/connection-health.service';
import {
  PatchErpSyncSettingsDto,
  UpsertErpSyncSettingsDto,
} from '../erp/erp-sync-settings.dto';
import { ErpSyncSettingsService } from '../erp/erp-sync-settings.service';

import {
  CreateErpConnectionDto,
  ErpManualSyncDto,
  TestErpConnectionDto,
  UpdateErpConnectionDto,
} from './erp-connection.dto';
import { ErpConnectionService } from './erp-connection.service';

@ApiTags('erp-connections')
@ApiBearerAuth()
@Controller('erp-connections')
export class ErpConnectionController {
  constructor(
    private readonly erpConnectionService: ErpConnectionService,
    private readonly erpSyncSettingsService: ErpSyncSettingsService,
    private readonly connectionHealthService: ConnectionHealthService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Organizasyonun ERP bağlantılarını listele' })
  @ApiResponse({ status: 200, description: 'Bağlantı listesi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async findAll(@CurrentOrg() org: CurrentOrgPayload) {
    return this.erpConnectionService.findAll(org.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Yeni ERP bağlantısı oluştur' })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 409, description: 'Çakışma' })
  async create(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CreateErpConnectionDto,
  ) {
    return this.erpConnectionService.create(org.id, dto);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'ERP bağlantısını test et' })
  @ApiResponse({ status: 200, description: 'Test sonucu' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async test(@CurrentOrg() org: CurrentOrgPayload, @Body() dto: TestErpConnectionDto) {
    return this.erpConnectionService.testConnection(org.id, dto);
  }

  @Get(':id/health')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'ERP bağlantı sağlık durumu' })
  @ApiResponse({ status: 200, description: 'Sağlık özeti' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async getHealth(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ) {
    const data = await this.connectionHealthService.getErpHealth(org.id, id);
    return { data };
  }

  @Post(':id/test')
  @Throttle({ default: { limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Kayıtlı ERP bağlantısını test et' })
  @ApiResponse({ status: 200, description: 'Test sonucu' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async testById(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ) {
    const data = await this.erpConnectionService.testConnectionById(org.id, id);
    return { data };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tekil ERP bağlantısı' })
  @ApiResponse({ status: 200, description: 'Bağlantı' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async findOne(@CurrentOrg() org: CurrentOrgPayload, @Param('id') id: string) {
    return this.erpConnectionService.findOne(org.id, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'ERP bağlantısını güncelle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async update(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdateErpConnectionDto,
  ) {
    return this.erpConnectionService.update(org.id, id, dto);
  }

  @Get(':id/sync-settings')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'ERP senkron ayarlarını getir' })
  @ApiResponse({ status: 200, description: 'Senkron ayarları' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async getSyncSettings(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ) {
    const data = await this.erpSyncSettingsService.getSettings(org.id, id);
    return { data };
  }

  @Put(':id/sync-settings')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'ERP senkron ayarlarını kaydet (tam)' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async upsertSyncSettings(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpsertErpSyncSettingsDto,
  ) {
    const data = await this.erpSyncSettingsService.upsertSettings(
      org.id,
      id,
      dto,
    );
    return { data };
  }

  @Patch(':id/sync-settings')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'ERP senkron ayarlarını kısmi güncelle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async patchSyncSettings(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: PatchErpSyncSettingsDto,
  ) {
    const data = await this.erpSyncSettingsService.patchSettings(
      org.id,
      id,
      dto,
    );
    return { data };
  }

  @Post(':id/sync')
  @Throttle({ default: { limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'ERP manuel senkron başlat (tür seçilebilir)' })
  @ApiResponse({ status: 200, description: 'Kuyruğa alındı' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async sync(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: ErpManualSyncDto,
  ): Promise<{ data: { jobId: string; estimatedDuration: number } }> {
    const result = await this.erpSyncSettingsService.triggerManualSyncWithType(
      org.id,
      id,
      dto.type,
    );
    return { data: result };
  }

  @Post(':id/sync-now')
  @Throttle({ default: { limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'ERP bağlantısı için manuel senkron başlat' })
  @ApiResponse({ status: 200, description: 'Kuyruğa alındı' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async syncNow(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return this.erpSyncSettingsService.triggerManualSync(org.id, id);
  }

  @Post(':id/sync-order/:orderId')
  @Throttle({ default: { limit: 10 } })
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Siparişi ERP üzerinde fatura olarak oluştur' })
  @ApiResponse({ status: 200, description: 'Fatura oluşturuldu' })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Kayıt bulunamadı' })
  async syncOrderToErp(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') connectionId: string,
    @Param('orderId') orderId: string,
  ): Promise<{ invoiceNo: string }> {
    return this.erpConnectionService.syncOrderToErp(
      connectionId,
      orderId,
      org.id,
      user.id,
      user.organizationId,
      user.isImpersonating,
      user.isImpersonating ? user.currentOrgId : null,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'ERP bağlantısını sil (yumuşak silme)' })
  @ApiResponse({ status: 200, description: 'Silindi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async remove(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.erpConnectionService.remove(org.id, id);
    return { success: true };
  }
}
