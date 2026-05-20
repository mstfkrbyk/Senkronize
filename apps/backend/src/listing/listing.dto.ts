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

import { ListingSort, ListingStatus } from './listing.types';

export { ListingSort, ListingStatus } from './listing.types';

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
  @IsEnum(ListingStatus)
  status?: ListingStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceMax?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stockMax?: number;

  @IsOptional()
  @IsEnum(ListingSort)
  sort?: ListingSort;

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

export class BulkStatusDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];

  @IsEnum(ListingStatus)
  status!: ListingStatus;
}

export class BulkPriceItemDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsNumber()
  @IsPositive()
  price!: number;
}

export class BulkPriceDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPriceItemDto)
  updates!: BulkPriceItemDto[];
}

export class BulkStockItemDto {
  @IsString()
  @IsNotEmpty()
  id!: string;

  @IsInt()
  @Min(0)
  stock!: number;
}

export class BulkStockDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkStockItemDto)
  updates!: BulkStockItemDto[];
}

export class BulkPushDto {
  @IsArray()
  @IsString({ each: true })
  ids!: string[];
}
