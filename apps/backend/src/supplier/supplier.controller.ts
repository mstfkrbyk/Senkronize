import {
  Body,
  Controller,
  Delete,
  Get,
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
import type { Supplier, SupplierContact } from '@prisma/client';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  CreateSupplierContactDto,
  CreateSupplierDto,
  SupplierQueryDto,
  UpdateSupplierDto,
} from './supplier.dto';
import type { SupplierListRow, SupplierPerformance } from './supplier.service';
import { SupplierService } from './supplier.service';

@ApiTags('suppliers')
@ApiBearerAuth()
@Controller('suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tedarikçi oluştur' })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  async create(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CreateSupplierDto,
  ): Promise<{ data: Supplier }> {
    const data = await this.supplierService.create(org.id, dto);
    return { data };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tedarikçi listesi' })
  async findAll(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: SupplierQueryDto,
  ): Promise<{ data: SupplierListRow[]; total: number; page: number; limit: number }> {
    return this.supplierService.findAll(org.id, query);
  }

  @Get(':id/performance')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tedarikçi performansı (teslimat süresi, sipariş geçmişi)' })
  async performance(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: SupplierPerformance }> {
    const data = await this.supplierService.getPerformance(org.id, id);
    return { data };
  }

  @Post(':id/contact')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tedarikçi iletişim kaydı ekle' })
  @ApiResponse({ status: 201, description: 'Kayıt eklendi' })
  async addContact(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: CreateSupplierContactDto,
  ): Promise<{ data: SupplierContact }> {
    const data = await this.supplierService.addContact(org.id, id, dto);
    return { data };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tedarikçi detayı' })
  async findOne(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: Supplier }> {
    const data = await this.supplierService.findOne(org.id, id);
    return { data };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tedarikçi güncelle' })
  async update(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ): Promise<{ data: Supplier }> {
    const data = await this.supplierService.update(org.id, id, dto);
    return { data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tedarikçiyi sil (yumuşak)' })
  async remove(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.supplierService.remove(org.id, id);
    return { success: true };
  }
}
