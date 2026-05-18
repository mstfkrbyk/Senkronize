import { Marketplace } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
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

export class ListingQueryDto {
  @IsOptional()
  @IsEnum(Marketplace)
  platform?: Marketplace;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  approved?: boolean;

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
