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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  CreateConnectionDto,
  TestConnectionDto,
  UpdateConnectionDto,
} from './marketplace-connection.dto';
import { MarketplaceConnectionService } from './marketplace-connection.service';

@ApiTags('marketplace-connections')
@ApiBearerAuth()
@Controller('marketplace-connections')
export class MarketplaceConnectionController {
  constructor(
    private readonly marketplaceConnectionService: MarketplaceConnectionService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Organizasyonun pazaryeri bağlantılarını listele' })
  @ApiResponse({ status: 200, description: 'Bağlantı listesi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async findAll(@CurrentOrg() org: CurrentOrgPayload) {
    return this.marketplaceConnectionService.findAll(org.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Yeni pazaryeri bağlantısı oluştur' })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 409, description: 'Çakışma' })
  async create(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CreateConnectionDto,
  ) {
    return this.marketplaceConnectionService.create(org.id, dto);
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Pazaryeri bağlantısını test et (kaydetmeden)',
  })
  @ApiResponse({ status: 200, description: 'Test sonucu' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async test(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: TestConnectionDto,
  ) {
    return this.marketplaceConnectionService.testConnection(org.id, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tekil pazaryeri bağlantısı' })
  @ApiResponse({ status: 200, description: 'Bağlantı' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async findOne(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ) {
    return this.marketplaceConnectionService.findOne(org.id, id);
  }

  @Post(':id/register-webhook')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Webhook URL için gizli anahtar üret ve kaydet',
  })
  @ApiResponse({ status: 200, description: 'Webhook URL döndürüldü' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async registerWebhook(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ webhookUrl: string }> {
    return this.marketplaceConnectionService.registerWebhook(org.id, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Bağlantıyı güncelle (kimlik bilgisi veya aktiflik)' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async update(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdateConnectionDto,
  ) {
    return this.marketplaceConnectionService.update(org.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Bağlantıyı sil (yumuşak silme)' })
  @ApiResponse({ status: 200, description: 'Silindi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async remove(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.marketplaceConnectionService.remove(org.id, id);
    return { success: true };
  }
}
