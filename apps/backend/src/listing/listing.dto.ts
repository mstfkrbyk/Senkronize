import { Marketplace } from '@prisma/client';
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
  IsPositive,
  IsString,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export enum ListingStockTier {
  IN_STOCK = 'IN_STOCK',
  LOW = 'LOW',
  OUT = 'OUT',
}

export class ListingQueryDto {
  @IsOptional()
  @IsEnum(Marketplace)
  platform?: Marketplace;

  @IsOptional()
  @Transform(({ value }) => parseMarketplaceCsv(value))
  @IsArray()
  @IsEnum(Marketplace, { each: true })
  platforms?: Marketplace[];

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  approved?: boolean;

  @IsOptional()
  @IsEnum(ListingStockTier)
  stockTier?: ListingStockTier;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSalePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxSalePrice?: number;

  @IsOptional()
  @IsDateString()
  lastSyncAtSince?: string;

  @IsOptional()
  @IsDateString()
  lastSyncAtUntil?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
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

export class UpdatePriceDto {
  @IsNumber()
  @IsPositive()
  salePrice!: number;

  @IsNumber()
  @IsPositive()
  listPrice!: number;
}

export class UpdateStockDto {
  @IsInt()
  @Min(0)
  quantity!: number;
}

export class BulkUpdateItemDto {
  @IsOptional()
  @IsString()
  listingId?: string;

  @ValidateIf((o: BulkUpdateItemDto) => !o.listingId)
  @IsString()
  @IsNotEmpty()
  barcode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  salePrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  listPrice?: number;
}

export class BulkUpdateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkUpdateItemDto)
  items!: BulkUpdateItemDto[];
}

export class RetrySyncJobDto {
  @IsString()
  @IsNotEmpty()
  auditLogId!: string;
}
