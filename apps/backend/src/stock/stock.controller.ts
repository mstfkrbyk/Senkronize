import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
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
import type { StockEntry } from '@prisma/client';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { BulkStockUpdateDto } from './stock.dto';
import { StockService } from './stock.service';

@ApiTags('Stok')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Stok kayıtları' })
  @ApiResponse({ status: 200, description: 'Liste' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async findAll(@CurrentOrg() org: CurrentOrgPayload): Promise<StockEntry[]> {
    return this.stockService.findAll(org.id);
  }

  @Get('low-stock')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Düşük stok uyarısı' })
  @ApiResponse({ status: 200, description: 'Liste' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async getLowStock(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query('threshold', new DefaultValuePipe(10), ParseIntPipe)
    threshold: number,
  ): Promise<
    Array<
      StockEntry & {
        product: {
          id: string;
          name: string;
          barcode: string;
          sku: string | null;
        } | null;
      }
    >
  > {
    return this.stockService.getLowStock(org.id, threshold);
  }

  @Post('bulk-update')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Toplu stok güncelleme (kuyruk)' })
  @ApiResponse({ status: 201, description: 'İşler eklendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async bulkUpdate(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkStockUpdateDto,
  ): Promise<{ jobIds: string[] }> {
    return this.stockService.bulkUpdate(org.id, dto);
  }
}
