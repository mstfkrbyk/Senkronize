import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Marketplace, OrderStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cargoTrackingNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cargoProvider?: string;
}

export class OrderQueryDto {
  @IsOptional()
  @IsEnum(Marketplace)
  platform?: Marketplace;

  /** Virgülle ayrılmış pazaryeri kodları (çoklu filtre). */
  @IsOptional()
  @Transform(({ value }) => parseMarketplaceCsv(value))
  @IsArray()
  @IsEnum(Marketplace, { each: true })
  platforms?: Marketplace[];

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  /** Virgülle ayrılmış sipariş durumları. */
  @IsOptional()
  @Transform(({ value }) => parseOrderStatusCsv(value))
  @IsArray()
  @IsEnum(OrderStatus, { each: true })
  statuses?: OrderStatus[];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cargoProvider?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minTotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxTotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

function parseMarketplaceCsv(value: unknown): Marketplace[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const raw = Array.isArray(value) ? value.join(',') : String(value);
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) {
    return undefined;
  }
  const allowed = new Set<string>(Object.values(Marketplace));
  return parts.filter((p): p is Marketplace => allowed.has(p));
}

function parseOrderStatusCsv(value: unknown): OrderStatus[] | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const raw = Array.isArray(value) ? value.join(',') : String(value);
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length === 0) {
    return undefined;
  }
  const allowed = new Set<string>(Object.values(OrderStatus));
  return parts.filter((p): p is OrderStatus => allowed.has(p));
}

export interface OrderSummaryDto {
  todayOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  byPlatform: Record<string, number>;
  byStatus: Record<string, number>;
}
