import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrgProductLine } from '@prisma/client';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  ProductLineGuard,
  RequireProduct,
} from '../common/guards/product-line.guard';
import type { SerializedInvoice } from '../invoice/invoice.types';

import { AccountingCustomerService } from './accounting-customer.service';
import { AccountingInventoryService } from './accounting-inventory.service';
import {
  BulkAccountingInvoiceIdsDto,
  CreateAccountingInvoiceDto,
  MarkPaidAccountingInvoiceDto,
} from './accounting.dto';
import { AccountingInvoiceService } from './accounting-invoice.service';
import type {
  AccountingBulkResult,
  AccountingInventoryValuation,
  AccountingOverview,
  AccountingRevenueTrend,
  AccountingVatSummary,
  CustomerLedgerSummariesMap,
  CustomersBalanceSummary,
  CustomerStatement,
  PushToErpResult,
} from './accounting.types';

@ApiTags('accounting')
@ApiBearerAuth()
@Controller('accounting')
@RequireProduct(OrgProductLine.ACCOUNTING)
@UseGuards(JwtAuthGuard, ProductLineGuard)
export class AccountingController {
  constructor(
    private readonly accountingInvoiceService: AccountingInvoiceService,
    private readonly accountingCustomerService: AccountingCustomerService,
    private readonly accountingInventoryService: AccountingInventoryService,
  ) {}

  @Get('overview')
  @ApiOperation({ summary: 'Ön muhasebe KPI özeti' })
  @ApiResponse({
    status: 200,
    description: 'Açık fatura, tahsilat, KDV ve cari alacak özeti',
  })
  async getOverview(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ data: AccountingOverview }> {
    const data = await this.accountingInvoiceService.getOverview(org.id);
    return { data };
  }

  @Get('revenue-trend')
  @ApiOperation({ summary: 'Aylık fatura gelir trendi' })
  @ApiResponse({ status: 200, description: 'Son N ay fatura toplamları' })
  async getRevenueTrend(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query('months', new DefaultValuePipe(6), ParseIntPipe) months: number,
  ): Promise<{ data: AccountingRevenueTrend }> {
    const data = await this.accountingInvoiceService.getRevenueTrend(org.id, months);
    return { data };
  }

  @Get('inventory-valuation')
  @ApiOperation({ summary: 'Stok değerleme (miktar × maliyet)' })
  @ApiResponse({ status: 200, description: 'Toplam miktar ve stok değeri' })
  @ApiResponse({ status: 404, description: 'Depo bulunamadı' })
  async getInventoryValuation(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query('warehouseId') warehouseId?: string,
  ): Promise<{ data: AccountingInventoryValuation }> {
    const data = await this.accountingInventoryService.getInventoryValuation(
      org.id,
      warehouseId,
    );
    return { data };
  }

  @Get('vat-summary')
  @ApiOperation({ summary: 'Aylık KDV özeti (faturalar)' })
  @ApiResponse({ status: 200, description: 'Seçilen ay için matrah, KDV ve toplam' })
  @ApiResponse({ status: 400, description: 'Geçersiz month (YYYY-MM)' })
  async getVatSummary(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query('month') month?: string,
  ): Promise<{ data: AccountingVatSummary }> {
    if (!month?.trim()) {
      throw new BadRequestException('month parametresi zorunludur (YYYY-MM)');
    }
    const data = await this.accountingInvoiceService.getVatSummary(org.id, month);
    return { data };
  }

  @Get('customers/ledger-summaries')
  @ApiOperation({ summary: 'Müşteri cari borç/alacak/bakiye özetleri' })
  @ApiResponse({ status: 200, description: 'Özet haritası (customerId → bakiye)' })
  async getCustomerLedgerSummaries(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query('ids') ids?: string,
  ): Promise<{ data: CustomerLedgerSummariesMap }> {
    const customerIds = ids
      ?.split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    const data = await this.accountingCustomerService.getLedgerSummaries(
      org.id,
      customerIds?.length ? customerIds : undefined,
    );
    return { data };
  }

  @Get('customers/balance-summary')
  @ApiOperation({ summary: 'Tüm müşteriler cari borç/alacak toplamı' })
  @ApiResponse({ status: 200, description: 'Toplam borç, alacak, bakiye ve müşteri sayısı' })
  async getCustomersBalanceSummary(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ data: CustomersBalanceSummary }> {
    const data = await this.accountingCustomerService.getBalanceSummary(org.id);
    return { data };
  }

  @Get('customers/:id/statement')
  @ApiOperation({ summary: 'Cari ekstre' })
  @ApiResponse({ status: 200, description: 'Ekstre' })
  @ApiResponse({ status: 404, description: 'Müşteri bulunamadı' })
  async getCustomerStatement(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') customerId: string,
  ): Promise<{ data: CustomerStatement }> {
    const data = await this.accountingCustomerService.getStatement(org.id, customerId);
    return { data };
  }

  @Post('invoices')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Manuel fatura oluştur (taslak)' })
  @ApiBody({ type: CreateAccountingInvoiceDto })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  async createInvoice(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CreateAccountingInvoiceDto,
  ): Promise<{ data: SerializedInvoice }> {
    const data = await this.accountingInvoiceService.createManual(org.id, dto);
    return { data };
  }

  @Post('invoices/bulk/issue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seçili taslak faturaları toplu kes (en fazla 50)' })
  @ApiBody({ type: BulkAccountingInvoiceIdsDto })
  @ApiResponse({ status: 200, description: 'Toplu kesim özeti' })
  async bulkIssueInvoices(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() body: BulkAccountingInvoiceIdsDto,
  ): Promise<{ data: AccountingBulkResult }> {
    const data = await this.accountingInvoiceService.bulkIssue(org.id, body.invoiceIds);
    return { data };
  }

  @Post('invoices/bulk/mark-paid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Seçili faturaları toplu ödendi işaretle (en fazla 50)' })
  @ApiBody({ type: BulkAccountingInvoiceIdsDto })
  @ApiResponse({ status: 200, description: 'Toplu ödeme özeti' })
  async bulkMarkPaidInvoices(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() body: BulkAccountingInvoiceIdsDto,
  ): Promise<{ data: AccountingBulkResult }> {
    const data = await this.accountingInvoiceService.bulkMarkPaid(org.id, body.invoiceIds);
    return { data };
  }

  @Post('invoices/:id/issue')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Faturayı kes (ISSUED → SENT)' })
  @ApiResponse({ status: 200, description: 'Kesildi' })
  @ApiResponse({ status: 400, description: 'Geçersiz durum' })
  async issueInvoice(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: SerializedInvoice }> {
    const data = await this.accountingInvoiceService.issue(org.id, id);
    return { data };
  }

  @Post('invoices/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Faturayı iptal et' })
  @ApiResponse({ status: 200, description: 'İptal edildi' })
  @ApiResponse({ status: 400, description: 'Geçersiz durum' })
  async cancelInvoice(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ data: SerializedInvoice }> {
    const data = await this.accountingInvoiceService.cancel(org.id, id);
    return { data };
  }

  @Post('invoices/:id/mark-paid')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Faturayı ödenmiş işaretle (tahsilat)' })
  @ApiBody({ type: MarkPaidAccountingInvoiceDto })
  @ApiResponse({ status: 200, description: 'Ödendi olarak işaretlendi' })
  @ApiResponse({ status: 400, description: 'Geçersiz durum' })
  @ApiResponse({ status: 409, description: 'Zaten ödenmiş' })
  async markPaidInvoice(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: MarkPaidAccountingInvoiceDto,
  ): Promise<{ data: SerializedInvoice }> {
    const data = await this.accountingInvoiceService.markPaid(org.id, id, dto);
    return { data };
  }

  @Post('invoices/:id/push-to-erp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kesilmiş faturayı harici ERP\'ye gönder' })
  @ApiResponse({ status: 200, description: 'ERP\'ye gönderildi' })
  @ApiResponse({ status: 400, description: 'ERP bağlantısı yok veya geçersiz' })
  async pushToErp(
    @CurrentOrg() org: CurrentOrgPayload,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ data: PushToErpResult }> {
    const data = await this.accountingInvoiceService.pushToErp(
      org.id,
      id,
      user.id,
      user.organizationId,
      user.isImpersonating,
      user.isImpersonating ? user.currentOrgId : null,
    );
    return { data };
  }
}
