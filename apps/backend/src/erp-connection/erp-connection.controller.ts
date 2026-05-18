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
  CreateErpConnectionDto,
  TestErpConnectionDto,
  UpdateErpConnectionDto,
} from './erp-connection.dto';
import { ErpConnectionService } from './erp-connection.service';

@ApiTags('erp-connections')
@ApiBearerAuth()
@Controller('erp-connections')
export class ErpConnectionController {
  constructor(private readonly erpConnectionService: ErpConnectionService) {}

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
