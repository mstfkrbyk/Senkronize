import { ReportType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import type { ReportFilterOperator } from './custom-report.types';

export class ReportFilterDto {
  @IsString()
  @MaxLength(64)
  field!: string;

  @IsIn(['eq', 'gt', 'lt', 'contains', 'in'])
  operator!: ReportFilterOperator;

  @IsOptional()
  value?: unknown;
}

export class ReportDateRangeDto {
  @IsString()
  from!: string;

  @IsString()
  to!: string;
}

export class ReportConfigDto {
  @IsEnum(ReportType)
  reportType!: ReportType;

  @IsArray()
  @IsString({ each: true })
  columns!: string[];

  @IsOptional()
  @IsObject()
  columnLabels?: Record<string, string>;

  @IsOptional()
  @IsObject()
  columnHidden?: Record<string, boolean>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportFilterDto)
  filters!: ReportFilterDto[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  groupBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orderBy?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReportDateRangeDto)
  dateRange?: ReportDateRangeDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  limit?: number;
}

export class RunReportBodyDto {
  @ValidateNested()
  @Type(() => ReportConfigDto)
  config!: ReportConfigDto;

  @IsOptional()
  @IsBoolean()
  preview?: boolean;
}

export class SaveReportBodyDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(ReportType)
  reportType!: ReportType;

  @ValidateNested()
  @Type(() => ReportConfigDto)
  config!: ReportConfigDto;

  @IsOptional()
  @IsObject()
  schedule?: Record<string, unknown>;
}

export class ExportFormatQueryDto {
  @IsIn(['csv', 'json'])
  format!: 'csv' | 'json';
}

export class UpdateScheduleBodyDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cron?: string | null;

  @IsArray()
  @IsEmail({}, { each: true })
  emails!: string[];

  @IsOptional()
  @IsIn(['csv', 'json'])
  format?: 'csv' | 'json';

  @IsOptional()
  @IsIn(['daily', 'weekly'])
  frequency?: 'daily' | 'weekly';
}
