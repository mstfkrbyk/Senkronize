import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

import { isAllowedDashboardPeriod } from './dashboard-period.util';
import type { DashboardWidgetConfig, DashboardWidgetSize } from './dashboard.types';

export class DashboardSummaryQueryDto {
  @IsOptional()
  @IsIn(['default', '24h', '7d', 'month'])
  period?: 'default' | '24h' | '7d' | 'month';
}

export class DashboardPeriodQueryDto {
  @IsOptional()
  @IsString()
  period?: string;

  resolvePeriod(): '7d' | '30d' | '90d' {
    const raw = (this.period ?? '30d').trim().toLowerCase();
    if (isAllowedDashboardPeriod(raw)) {
      return raw;
    }
    if (raw === '7d' || raw === '7') {
      return '7d';
    }
    if (raw === '90d' || raw === '90') {
      return '90d';
    }
    return '30d';
  }
}

export class DashboardOrdersTrendQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  days?: number;
}

export class DashboardRevenueTrendQueryDto extends DashboardPeriodQueryDto {
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: 'day' | 'week' | 'month';
}

export class DashboardTopProductsQueryDto extends DashboardPeriodQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class DashboardActivityQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class DashboardWidgetItemDto implements DashboardWidgetConfig {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsIn(['1x1', '2x1', '2x2'])
  size!: DashboardWidgetSize;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  position!: number;

  @IsOptional()
  @IsBoolean()
  visible?: boolean;
}

export class UpdateDashboardWidgetsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardWidgetItemDto)
  widgets!: DashboardWidgetItemDto[];
}
