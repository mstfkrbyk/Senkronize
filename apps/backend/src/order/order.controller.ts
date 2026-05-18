import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import {
  CancellationRequestDto,
  CancelOrderDto,
  OrderQueryDto,
  type OrderSummaryDto,
  UpdateOrderStatusDto,
} from './order.dto';
import { OrderService, type SerializedOrder } from './order.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş özet KPI' })
  @ApiResponse({ status: 200, description: 'Özet' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async getSummary(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<OrderSummaryDto> {
    return this.orderService.getSummary(org.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş listesi' })
  @ApiResponse({ status: 200, description: 'Liste' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  async findAll(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: OrderQueryDto,
  ): Promise<{ items: SerializedOrder[]; total: number }> {
    return this.orderService.findAll(org.id, query);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş durumu güncelle (kargo bilgisi dahil)' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async updateOrderStatus(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ): Promise<SerializedOrder> {
    return this.orderService.updateStatus(org.id, id, dto);
  }

  @Post(':id/cancellation-request')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş iptal talebi oluştur' })
  @ApiResponse({ status: 200, description: 'Kaydedildi' })
  async requestCancellation(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: CancellationRequestDto,
  ): Promise<SerializedOrder> {
    return this.orderService.requestOrderCancellation(org.id, id, dto.note);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Siparişi iptal et (platform + stok, kuyruk)' })
  @ApiResponse({ status: 200, description: 'İş oluşturuldu' })
  async cancel(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ): Promise<{ jobId: string }> {
    return this.orderService.cancelOrder(org.id, id, dto.reason);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş detayı' })
  @ApiResponse({ status: 200, description: 'Detay' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async findOne(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<SerializedOrder> {
    return this.orderService.findOne(org.id, id);
  }
}
