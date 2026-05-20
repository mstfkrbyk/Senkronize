import { Marketplace } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ReportScheduleFrequency, StandardReportKind } from '@prisma/client';

export class DashboardSummaryQueryDto {
  @IsOptional()
  @IsIn(['default', '24h', '7d', 'month'])
  period?: 'default' | '24h' | '7d' | 'month';
}

export class SalesReportQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';
}

export class PlatformReportQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class ProductsReportQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class StockMovementQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ProfitReportQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsEnum(Marketplace)
  platform?: Marketplace;
}

export class OrderTrendQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsIn(['daily', 'weekly', 'monthly'])
  granularity!: 'daily' | 'weekly' | 'monthly';
}

export class DateRangeReportQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class VatReportQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;
}

export class VatReportExportQueryDto extends VatReportQueryDto {
  @IsOptional()
  @IsIn(['csv'])
  format?: 'csv';
}

export class PdfReportQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d'])
  period?: '7d' | '30d' | '90d';
}

export class CreateReportScheduleDto {
  @IsEnum(StandardReportKind)
  reportKind!: StandardReportKind;

  @IsEnum(ReportScheduleFrequency)
  frequency!: ReportScheduleFrequency;

  @IsArray()
  @IsEmail({}, { each: true })
  emails!: string[];
}
