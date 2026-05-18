import { Marketplace, StockMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class StockQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(Marketplace)
  platform?: Marketplace;

  @IsOptional()
  @IsString()
  warehouseId?: string;

  @IsOptional()
  @IsBoolean()
  lowStock?: boolean;

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

export class StockHistoryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(StockMovementType)
  movementType?: StockMovementType;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsString()
  platform?: string;

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

export class StockSummaryQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;
}

export class StockAdjustDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  barcode!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  newQuantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class BulkStockUpdateItemDto {
  @IsString()
  @IsNotEmpty()
  barcode!: string;

  @IsInt()
  @Min(0)
  quantity!: number;
}

export class BulkStockUpdateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkStockUpdateItemDto)
  updates!: BulkStockUpdateItemDto[];
}
