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
import { OrgProductLine } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ProductLineGuard,
  RequireProduct,
} from '../common/guards/product-line.guard';

import {
  BulkInvoiceBodyDto,
  CreateInvoiceDto,
  InvoiceQueryDto,
  UpdateInvoiceStatusDto,
} from './invoice.dto';
import { InvoiceService } from './invoice.service';
import type { InvoiceListMeta, InvoiceStats, SerializedInvoice } from './invoice.types';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
@RequireProduct(OrgProductLine.ACCOUNTING)
@UseGuards(JwtAuthGuard, ProductLineGuard)
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Fatura istatistikleri' })
  @ApiResponse({ status: 200, description: 'Toplam ve aylık özet' })
  async getStats(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ data: InvoiceStats }> {
    const data = await this.invoiceService.getStats(org.id);
    return { data };
  }

  @Get()
  @ApiOperation({ summary: 'Fatura listesi' })
  @ApiResponse({ status: 200, description: 'Liste' })
  async findAll(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: InvoiceQueryDto,
  ): Promise<{
    items: SerializedInvoice[];
    total: number;
    page: number;
    limit: number;
    meta: InvoiceListMeta;
  }> {
    return this.invoiceService.findAll(org.id, query);
  }

  @Post()
  @ApiOperation({ summary: 'Yeni fatura oluştur' })
  @ApiBody({ type: CreateInvoiceDto })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  async create(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CreateInvoiceDto,
  ): Promise<{ data: SerializedInvoice }> {
    const data = await this.invoiceService.create(org.id, dto);
    return { data };
  }

  @Post('from-order/:orderId')
  @ApiOperation({ summary: 'Siparişten fatura oluştur' })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  async createFromOrder(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('orderId') orderId: string,
  ): Promise<{ data: SerializedInvoice }> {
    const data = await this.invoiceService.createFromOrder(org.id, orderId);
    return { data };
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Seçili siparişler için toplu fatura ZIP indir (en fazla 50)' })
  @ApiBody({ type: BulkInvoiceBodyDto })
  @ApiProduces('application/zip')
  @ApiResponse({ status: 200, description: 'ZIP arşivi' })
  async downloadBulkInvoices(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() body: BulkInvoiceBodyDto,
  ): Promise<StreamableFile> {
    const buffer = await this.invoiceService.generateBulkInvoicePdf(body.orderIds, org.id);
    return new StreamableFile(buffer, {
      type: 'application/zip',
      disposition: `attachment; filename="faturalar-${org.id.slice(-6)}.zip"`,
    });
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Sipariş satış faturası PDF indir (geriye dönük)' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF dosyası' })
  @ApiResponse({ status: 404, description: 'Sipariş bulunamadı' })
  async downloadOrderInvoice(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('orderId') orderId: string,
  ): Promise<StreamableFile> {
    return this.streamOrderInvoicePdf(org.id, orderId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fatura detayı' })
  @ApiResponse({ status: 200, description: 'Detay' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async findOne(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: SerializedInvoice }> {
    const data = await this.invoiceService.findOne(org.id, id);
    return { data };
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Fatura PDF indir' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF dosyası' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async downloadInvoicePdf(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const { buffer, fileName } = await this.invoiceService.generateInvoicePdfBuffer(
      org.id,
      id,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${fileName}"`,
    });
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Fatura durumu güncelle' })
  @ApiBody({ type: UpdateInvoiceStatusDto })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async updateStatus(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceStatusDto,
  ): Promise<{ data: SerializedInvoice }> {
    const data = await this.invoiceService.updateStatus(org.id, id, dto.status);
    return { data };
  }

  private async streamOrderInvoicePdf(
    organizationId: string,
    orderId: string,
  ): Promise<StreamableFile> {
    const buffer = await this.invoiceService.generateInvoicePdf(orderId, organizationId);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="fatura-${orderId.slice(-8)}.pdf"`,
    });
  }
}
