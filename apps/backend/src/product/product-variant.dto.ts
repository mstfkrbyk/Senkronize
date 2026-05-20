import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class CreateVariantDto {
  @IsString()
  @MinLength(1)
  sku!: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsObject()
  attributes!: Record<string, string>;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsNumber()
  costPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateVariantDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsObject()
  attributes?: Record<string, string>;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  price?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  costPrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkVariantItemDto {
  @IsString()
  @MinLength(1)
  sku!: string;

  @IsOptional()
  @IsString()
  barcode?: string | null;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsObject()
  attributes!: Record<string, string>;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  price?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  costPrice?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class BulkUpsertVariantsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkVariantItemDto)
  variants!: BulkVariantItemDto[];
}

export class CreateBulkVariantItemDto {
  @IsOptional()
  @IsString()
  color?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsObject()
  customAttributes?: Record<string, string>;

  @IsOptional()
  @IsString()
  sku?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock!: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsNumber()
  price?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateBulkVariantsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBulkVariantItemDto)
  variants!: CreateBulkVariantItemDto[];
}
