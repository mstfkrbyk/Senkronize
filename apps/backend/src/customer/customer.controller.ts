import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
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

import { CustomerNoteDto, CustomerQueryDto, CustomerTagsDto } from './customer.dto';
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

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Müşteri listesi' })
  @ApiResponse({ status: 200, description: 'Liste' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async findAll(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: CustomerQueryDto,
  ): Promise<{ items: SerializedCustomer[]; total: number; page: number; limit: number }> {
    return this.customerService.findAll(org.id, query);
  }

  @Get('segments')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Müşteri segment özeti' })
  @ApiResponse({ status: 200, description: 'Segmentler' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async getSegments(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<CustomerSegmentsSummary> {
    return this.customerService.getSegments(org.id);
  }

  @Get('export/csv')
  @UseGuards(JwtAuthGuard)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Müşteri listesini CSV olarak indir' })
  @ApiResponse({ status: 200, description: 'CSV' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async exportCsv(@CurrentOrg() org: CurrentOrgPayload): Promise<string> {
    return this.customerService.exportCsv(org.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Müşteri detayı' })
  @ApiResponse({ status: 200, description: 'Detay' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async findOne(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<CustomerDetail> {
    return this.customerService.findOne(org.id, id);
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
  ): Promise<SerializedCustomer> {
    if (dto.action === 'add') {
      return this.customerService.addTag(org.id, id, dto.tag);
    }
    return this.customerService.removeTag(org.id, id, dto.tag);
  }

  @Patch(':id/notes')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Müşteriye not ekle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async addNote(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: CustomerNoteDto,
  ): Promise<SerializedCustomer> {
    return this.customerService.addNote(org.id, id, dto.note);
  }
}
