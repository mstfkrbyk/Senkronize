import {
  Body,
  Controller,
  Delete,
  Get,
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
import type { StockEntry, Warehouse } from '@prisma/client';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  CreateWarehouseDto,
  TransferStockDto,
  UpdateWarehouseDto,
} from './warehouse.dto';
import { WarehouseService } from './warehouse.service';

@ApiTags('Depolar')
@ApiBearerAuth()
@Controller('warehouses')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Depo listesi' })
  @ApiResponse({ status: 200 })
  async list(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ data: Warehouse[] }> {
    const data = await this.warehouseService.listWarehouses(org.id);
    return { data };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Depo oluştur' })
  @ApiResponse({ status: 201 })
  async create(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CreateWarehouseDto,
  ): Promise<{ data: Warehouse }> {
    const data = await this.warehouseService.createWarehouse(org.id, dto);
    return { data };
  }

  @Post('transfer')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Depolar arası stok transferi (merkezi stok)' })
  @ApiResponse({ status: 201 })
  async transfer(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: TransferStockDto,
  ): Promise<{ success: true }> {
    await this.warehouseService.transferStock(org.id, dto);
    return { success: true };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Depo güncelle' })
  @ApiResponse({ status: 200 })
  async update(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
  ): Promise<{ data: Warehouse }> {
    const data = await this.warehouseService.updateWarehouse(org.id, id, dto);
    return { data };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Depo sil' })
  @ApiResponse({ status: 200 })
  async remove(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.warehouseService.deleteWarehouse(org.id, id);
    return { success: true };
  }

  @Post(':id/set-default')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Varsayılan depo ata' })
  @ApiResponse({ status: 200 })
  async setDefault(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    await this.warehouseService.setDefaultWarehouse(org.id, id);
    return { success: true };
  }

  @Get(':id/stock')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Depo stok kayıtları' })
  @ApiResponse({ status: 200 })
  async stock(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: StockEntry[] }> {
    const data = await this.warehouseService.getWarehouseStock(org.id, id);
    return { data };
  }
}
