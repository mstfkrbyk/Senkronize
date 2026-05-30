import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ProductLineGuard,
  RequireProduct,
} from '../common/guards/product-line.guard';
import { OrgProductLine } from '@prisma/client';

import {
  AddOrderNoteDto,
  AddTrackingNumberDto,
  BulkAssignCargoDto,
  BulkOrderIdsDto,
  BulkShipDto,
  BulkUpdateOrderStatusDto,
  CancellationRequestDto,
  CancelOrderDto,
  CreateOrderReturnDto,
  OrderQueryDto,
  type OrderSummaryDto,
  ShipOrderDto,
  UpdateOrderStatusDto,
} from './order.dto';
import { OrderService, type SerializedOrder } from './order.service';
import type { BulkResult, SerializedOrderNote } from './order.types';
import { ShippingLabelService } from './shipping-label.service';
import { ReturnService, type ReturnDetailDto } from '../return/return.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@RequireProduct(OrgProductLine.INTEGRATION)
@UseGuards(JwtAuthGuard, ProductLineGuard)
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly shippingLabelService: ShippingLabelService,
    private readonly returnService: ReturnService,
  ) {}

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

  @Post('bulk/cargo')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Toplu kargo şirketi ata' })
  @ApiResponse({ status: 200, description: 'Toplu işlem sonucu' })
  async bulkAssignCargo(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkAssignCargoDto,
  ): Promise<BulkResult> {
    return this.orderService.bulkAssignCargo(
      org.id,
      dto.orderIds,
      dto.cargoProvider,
    );
  }

  @Post('bulk/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Toplu durum güncelle' })
  @ApiResponse({ status: 200, description: 'Toplu işlem sonucu' })
  async bulkUpdateStatus(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkUpdateOrderStatusDto,
  ): Promise<BulkResult> {
    return this.orderService.bulkUpdateStatus(org.id, dto.orderIds, dto.status);
  }

  @Post('bulk/ship')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Toplu kargoya ver' })
  @ApiBody({ type: BulkShipDto })
  @ApiResponse({ status: 200, description: 'Toplu işlem sonucu' })
  async bulkShip(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkShipDto,
  ): Promise<BulkResult> {
    return this.orderService.bulkShip(org.id, dto.items);
  }

  @Post('bulk/invoice')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Seçili siparişler için toplu fatura ZIP indir' })
  @ApiBody({ type: BulkOrderIdsDto })
  @ApiProduces('application/zip')
  @ApiResponse({ status: 200, description: 'ZIP arşivi' })
  async bulkInvoice(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkOrderIdsDto,
  ): Promise<StreamableFile> {
    const buffer = await this.orderService.bulkInvoice(org.id, dto.orderIds);
    return new StreamableFile(buffer, {
      type: 'application/zip',
      disposition: `attachment; filename="faturalar-${org.id.slice(-6)}.zip"`,
    });
  }

  @Get('shipping-labels/zip')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş kargo etiketlerini ZIP olarak indir (GET)' })
  @ApiProduces('application/zip')
  @ApiResponse({ status: 200, description: 'ZIP arşivi' })
  @ApiResponse({ status: 404, description: 'Sipariş bulunamadı' })
  async downloadShippingLabelsZip(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query('orderIds') orderIdsRaw: string,
  ): Promise<StreamableFile> {
    const orderIds = orderIdsRaw
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    const buffer = await this.shippingLabelService.generateBulkLabels(orderIds, org.id);
    return new StreamableFile(buffer, {
      type: 'application/zip',
      disposition: `attachment; filename="etiketler-${org.id.slice(-6)}.zip"`,
    });
  }

  @Post('bulk/shipping-labels')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Seçili siparişler için toplu kargo etiketi ZIP indir' })
  @ApiBody({ type: BulkOrderIdsDto })
  @ApiProduces('application/zip')
  @ApiResponse({ status: 200, description: 'ZIP arşivi' })
  async bulkShippingLabels(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkOrderIdsDto,
  ): Promise<StreamableFile> {
    const buffer = await this.shippingLabelService.generateBulkLabels(
      dto.orderIds,
      org.id,
    );
    return new StreamableFile(buffer, {
      type: 'application/zip',
      disposition: `attachment; filename="etiketler-${org.id.slice(-6)}.zip"`,
    });
  }

  @Patch(':id/ship')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Siparişi kargoya ver' })
  @ApiResponse({ status: 200, description: 'Kargoya verildi' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async shipOrder(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: ShipOrderDto,
  ): Promise<SerializedOrder> {
    return this.orderService.shipOrder(org.id, id, dto);
  }

  @Post(':id/returns')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş için iade oluştur' })
  @ApiResponse({ status: 201, description: 'İade oluşturuldu' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async createReturn(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: CreateOrderReturnDto,
  ): Promise<ReturnDetailDto> {
    return this.returnService.createFromOrder(org.id, id, dto);
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

  @Patch(':id/tracking')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Kargo takip numarası ekle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async addTrackingNumber(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: AddTrackingNumberDto,
  ): Promise<SerializedOrder> {
    return this.orderService.addTrackingNumber(
      org.id,
      id,
      dto.trackingNumber,
      dto.cargoProvider,
    );
  }

  @Get(':id/notes')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş notları' })
  @ApiResponse({ status: 200, description: 'Not listesi' })
  async getOrderNotes(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<SerializedOrderNote[]> {
    return this.orderService.getOrderNotes(org.id, id);
  }

  @Post(':id/notes')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş notu ekle' })
  @ApiResponse({ status: 201, description: 'Not oluşturuldu' })
  async addOrderNote(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddOrderNoteDto,
  ): Promise<SerializedOrderNote> {
    return this.orderService.addOrderNote(
      org.id,
      id,
      user.id,
      dto.content,
      dto.isInternal ?? false,
    );
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

  @Get(':id/shipping-label')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Kargo etiketi PDF indir' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF dosyası' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async downloadShippingLabel(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const buffer = await this.shippingLabelService.generateLabel(id, org.id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="etiket-${id.slice(-8)}.pdf"`,
    });
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
