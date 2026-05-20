import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class DashboardSummaryQueryDto {
  @IsOptional()
  @IsIn(['default', '24h', '7d', 'month'])
  period?: 'default' | '24h' | '7d' | 'month';
}

export class DashboardOrdersTrendQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}

export class DashboardActivityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
