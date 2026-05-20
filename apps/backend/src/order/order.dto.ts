import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CargoProvider, Marketplace, OrderStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateOrderStatusDto {
  @ApiProperty({
    description: 'Siparişin yeni durumu',
    enum: OrderStatus,
    example: OrderStatus.SHIPPED,
    required: true,
  })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional({
    description: 'Kargo takip numarası',
    example: '733102837461',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cargoTrackingNumber?: string;

  @ApiPropertyOptional({
    description: 'Kargo sağlayıcı adı veya kodu',
    example: 'Yurtiçi Kargo',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cargoProvider?: string;
}

export class BulkOrderIdsDto {
  @ApiProperty({ description: 'Sipariş kimlikleri', type: [String] })
  @IsArray()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  orderIds!: string[];
}

export class BulkAssignCargoDto extends BulkOrderIdsDto {
  @ApiProperty({ enum: CargoProvider })
  @IsEnum(CargoProvider)
  cargoProvider!: CargoProvider;
}

export class BulkUpdateOrderStatusDto extends BulkOrderIdsDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

export class AddTrackingNumberDto {
  @ApiProperty({ description: 'Kargo takip numarası' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  trackingNumber!: string;

  @ApiProperty({ enum: CargoProvider })
  @IsEnum(CargoProvider)
  cargoProvider!: CargoProvider;
}

export class AddOrderNoteDto {
  @ApiProperty({ description: 'Not içeriği' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;

  @ApiPropertyOptional({ description: 'İç not (müşteriye görünmez)' })
  @IsOptional()
  @IsBoolean()
  isInternal?: boolean;
}

export class OrderQueryDto {
  @ApiPropertyOptional({
    description: 'Tekil pazaryeri filtresi',
    enum: Marketplace,
    example: Marketplace.TRENDYOL,
    required: false,
  })
  @IsOptional()
  @IsEnum(Marketplace)
  platform?: Marketplace;

  @ApiPropertyOptional({
    description: 'Virgülle ayrılmış pazaryeri kodları (çoklu filtre)',
    example: 'TRENDYOL,HEPSIBURADA',
    isArray: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseMarketplaceCsv(value))
  @IsArray()
  @IsEnum(Marketplace, { each: true })
  platforms?: Marketplace[];

  @ApiPropertyOptional({
    description: 'Tekil sipariş durumu filtresi',
    enum: OrderStatus,
    example: OrderStatus.NEW,
    required: false,
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({
    description: 'Virgülle ayrılmış sipariş durumları',
    example: 'NEW,PICKING',
    isArray: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => parseOrderStatusCsv(value))
  @IsArray()
  @IsEnum(OrderStatus, { each: true })
  statuses?: OrderStatus[];

  @ApiPropertyOptional({
    description: 'Aralık başlangıç tarihi (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Aralık bitiş tarihi (ISO 8601)',
    example: '2024-12-31T23:59:59.999Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Sipariş numarası veya müşteri adı ile metin araması',
    example: 'TY-2024-001234',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    description: 'Kargo firmasına göre filtre',
    example: 'Aras',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cargoProvider?: string;

  @ApiPropertyOptional({
    description: 'Minimum sipariş tutarı (TL)',
    example: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minTotal?: number;

  @ApiPropertyOptional({
    description: 'Maksimum sipariş tutarı (TL)',
    example: 5000,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxTotal?: number;

  @ApiPropertyOptional({
    description: 'Sayfa numarası (1 tabanlı)',
    example: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Sayfa başına kayıt sayısı (en fazla 100)',
    example: 20,
    minimum: 1,
    maximum: 100,
    required: false,
  })
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

export class CancelOrderDto {
  @ApiPropertyOptional({
    description: 'İptal nedeni (platforma iletilir)',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class CancellationRequestDto {
  @ApiPropertyOptional({
    description: 'İptal talebi açıklaması',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export interface OrderSummaryDto {
  todayOrders: number;
  pendingOrders: number;
  totalRevenue: number;
  byPlatform: Record<string, number>;
  byStatus: Record<string, number>;
}
