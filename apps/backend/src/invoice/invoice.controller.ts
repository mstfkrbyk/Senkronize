import { Body, Controller, Get, Param, Post, StreamableFile, UseGuards } from '@nestjs/common';
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

import { BulkInvoiceBodyDto } from './invoice.dto';
import { InvoiceService } from './invoice.service';

@ApiTags('invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Get('order/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş satış faturası PDF indir' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF dosyası' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
  @ApiResponse({ status: 404, description: 'Sipariş bulunamadı' })
  async downloadOrderInvoice(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('orderId') orderId: string,
  ): Promise<StreamableFile> {
    return this.streamOrderInvoicePdf(org.id, orderId);
  }

  @Get(':orderId/pdf')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Sipariş satış faturası PDF indir (kısa yol)' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'PDF dosyası' })
  @ApiResponse({ status: 404, description: 'Sipariş bulunamadı' })
  async downloadOrderInvoicePdf(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('orderId') orderId: string,
  ): Promise<StreamableFile> {
    return this.streamOrderInvoicePdf(org.id, orderId);
  }

  private async streamOrderInvoicePdf(
    organizationId: string,
    orderId: string,
  ): Promise<StreamableFile> {
    const buffer = await this.invoiceService.generateInvoicePdf(
      orderId,
      organizationId,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="fatura-${orderId.slice(-8)}.pdf"`,
    });
  }

  @Post('bulk')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Seçili siparişler için toplu fatura ZIP indir (en fazla 50)' })
  @ApiBody({ type: BulkInvoiceBodyDto })
  @ApiProduces('application/zip')
  @ApiResponse({ status: 200, description: 'ZIP arşivi' })
  @ApiResponse({ status: 401, description: 'Yetkisiz' })
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
}
