import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  ACCOUNTING_PAYMENT_METHODS,
  type AccountingPaymentMethodLabel,
} from './accounting-payment-labels';

export { ACCOUNTING_PAYMENT_METHODS };
export type AccountingPaymentMethod = AccountingPaymentMethodLabel;

import { InvoiceItemDto } from '../invoice/invoice.dto';

export class CreateAccountingInvoiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  customerName!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  customerEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  customerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customerAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  customerTaxId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items!: InvoiceItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  taxRate?: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isEArchive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  customerId?: string;
}

export class BulkAccountingInvoiceIdsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  invoiceIds!: string[];
}

export class MarkPaidAccountingInvoiceDto {
  @IsOptional()
  @IsDateString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  @IsIn(ACCOUNTING_PAYMENT_METHODS)
  paymentMethod?: AccountingPaymentMethod;
}
