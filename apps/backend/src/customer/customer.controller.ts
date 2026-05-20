import {
  Body,
  Controller,
  Get,
  Header,
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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  CustomerNoteDto,
  CustomerQueryDto,
  CustomerTagsDto,
} from './customer.dto';
import { CustomerService } from './customer.service';
import type {
  CustomerDetail,
  CustomerSegmentsSummary,
  SerializedCustomer,
} from './customer.types';

@ApiTags('customers')
@ApiBearerAuth()
@Controller('customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get('segments')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Müşteri segment istatistikleri' })
  @ApiResponse({ status: 200, description: 'Segment sayıları ve gelir' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async getSegments(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ data: CustomerSegmentsSummary }> {
    const data = await this.customerService.getSegments(org.id);
    return { data };
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="musteriler.csv"')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Müşteri listesi CSV dışa aktarım' })
  @ApiResponse({ status: 200, description: 'CSV' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async exportCsv(@CurrentOrg() org: CurrentOrgPayload): Promise<string> {
    return this.customerService.exportCsv(org.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Müşteri listesi' })
  @ApiResponse({ status: 200, description: 'Liste' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async findAll(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: CustomerQueryDto,
  ): Promise<{
    items: SerializedCustomer[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.customerService.findAll(org.id, query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Müşteri detayı ve sipariş geçmişi' })
  @ApiResponse({ status: 200, description: 'Detay' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async findOne(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: CustomerDetail }> {
    const data = await this.customerService.findOne(org.id, id);
    return { data };
  }

  @Patch(':id/tags')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Müşteri etiketi ekle veya kaldır' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async updateTags(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: CustomerTagsDto,
  ): Promise<{ data: SerializedCustomer }> {
    const data =
      dto.action === 'add'
        ? await this.customerService.addTag(org.id, id, dto.tag)
        : await this.customerService.removeTag(org.id, id, dto.tag);
    return { data };
  }

  @Post(':id/notes')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Müşteriye not ekle' })
  @ApiResponse({ status: 200, description: 'Not eklendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async addNote(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: CustomerNoteDto,
  ): Promise<{ data: SerializedCustomer }> {
    const data = await this.customerService.addNote(org.id, id, dto.note);
    return { data };
  }
}
