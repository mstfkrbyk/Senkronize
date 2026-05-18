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
import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { BulkStockUpdateDto, StockQueryDto } from './stock.dto';
import {
  StockService,
  type LowStockEntryRow,
  type SerializedStockEntry,
} from './stock.service';

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
  async findAll(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: StockQueryDto,
  ): Promise<{ items: SerializedStockEntry[]; total: number }> {
    return this.stockService.findAll(org.id, query);
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
  ): Promise<LowStockEntryRow[]> {
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
