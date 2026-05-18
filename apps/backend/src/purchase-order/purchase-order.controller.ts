import {
  Body,
  Controller,
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

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  CreatePurchaseOrderDto,
  PurchaseOrderQueryDto,
  PurchaseSuggestionsQueryDto,
  ReceivePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './purchase-order.dto';
import type {
  PurchaseOrderDetail,
  ReplenishmentSuggestion,
} from './purchase-order.service';
import { PurchaseOrderService } from './purchase-order.service';

@ApiTags('purchase-orders')
@ApiBearerAuth()
@Controller('purchase-orders')
export class PurchaseOrderController {
  constructor(private readonly purchaseOrderService: PurchaseOrderService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Taslak satın alma siparişi oluştur' })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  async create(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CreatePurchaseOrderDto,
  ): Promise<{ data: PurchaseOrderDetail }> {
    const data = await this.purchaseOrderService.createPO(org.id, dto);
    return { data };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Satın alma siparişleri' })
  async list(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: PurchaseOrderQueryDto,
  ): Promise<{ data: PurchaseOrderDetail[]; total: number; page: number; limit: number }> {
    return this.purchaseOrderService.findAll(org.id, query);
  }

  @Get('open')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Açık / bekleyen siparişler' })
  async open(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ data: PurchaseOrderDetail[] }> {
    const data = await this.purchaseOrderService.getOpenPOs(org.id);
    return { data };
  }

  @Get('suggestions')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Düşük stok için satın alma önerileri' })
  async suggestions(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: PurchaseSuggestionsQueryDto,
  ): Promise<{ data: ReplenishmentSuggestion[] }> {
    const data = await this.purchaseOrderService.getReplenishmentSuggestions(org.id, query);
    return { data };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş detayı' })
  async one(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: PurchaseOrderDetail }> {
    const data = await this.purchaseOrderService.findOne(org.id, id);
    return { data };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş güncelle (not / beklenen tarih)' })
  async patch(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ): Promise<{ data: PurchaseOrderDetail }> {
    const data = await this.purchaseOrderService.updatePO(org.id, id, dto);
    return { data };
  }

  @Post(':id/send')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tedarikçiye e-posta ile gönder' })
  async send(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: PurchaseOrderDetail }> {
    const data = await this.purchaseOrderService.sendPO(org.id, id);
    return { data };
  }

  @Post(':id/receive')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Teslim al ve stoğu artır' })
  async receive(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
  ): Promise<{ data: PurchaseOrderDetail }> {
    const data = await this.purchaseOrderService.receiveItems(org.id, id, dto);
    return { data };
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Siparişi iptal et' })
  async cancel(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: PurchaseOrderDetail }> {
    const data = await this.purchaseOrderService.cancelPO(org.id, id);
    return { data };
  }
}
