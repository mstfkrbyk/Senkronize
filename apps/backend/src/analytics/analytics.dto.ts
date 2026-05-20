import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class AnalyticsPeriodQueryDto {
  @IsOptional()
  @IsString()
  period?: string;
}

export class AnalyticsDaysQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}

export class TopProductsQueryDto extends AnalyticsPeriodQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class AnalyticsExportQueryDto extends AnalyticsPeriodQueryDto {
  @IsIn(['revenue', 'orders', 'products'])
  type!: 'revenue' | 'orders' | 'products';

  @IsIn(['csv', 'xlsx'])
  format!: 'csv' | 'xlsx';
}
