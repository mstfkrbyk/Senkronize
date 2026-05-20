import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Marketplace } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class BulkProductIdsDto {
  @ApiProperty({ type: [String], description: 'Ürün kimlikleri' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  productIds!: string[];
}

export class BulkPriceUpdateDto extends BulkProductIdsDto {
  @ApiProperty({ enum: ['fixed', 'percentage', 'set'] })
  @IsIn(['fixed', 'percentage', 'set'])
  updateType!: 'fixed' | 'percentage' | 'set';

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ enum: ['increase', 'decrease'] })
  @IsOptional()
  @IsIn(['increase', 'decrease'])
  direction?: 'increase' | 'decrease';

  @ApiProperty({ enum: ['salePrice', 'listPrice', 'both'] })
  @IsIn(['salePrice', 'listPrice', 'both'])
  applyToField!: 'salePrice' | 'listPrice' | 'both';

  @ApiPropertyOptional({
    description: 'Yalnızca seçili pazaryerlerindeki listing fiyatları',
    enum: Marketplace,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(Marketplace, { each: true })
  platforms?: Marketplace[];
}

export class BulkStockUpdateDto extends BulkProductIdsDto {
  @ApiProperty({ example: 50, description: 'Tüm varyantlara atanacak stok' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock!: number;
}

export class BulkCategoryAssignDto extends BulkProductIdsDto {
  @ApiPropertyOptional({ example: 'Elektronik', description: 'Metin kategori adı' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  category?: string;

  @ApiPropertyOptional({ description: 'Hiyerarşik kategori kimliği' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string;
}

export class BulkStatusUpdateDto extends BulkProductIdsDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  isActive!: boolean;
}

export class ReorderProductImageIdsDto {
  @ApiProperty({ type: [String], description: 'Yeni sıra (görsel kimlikleri)' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  imageIds!: string[];
}

export class BulkPlatformSyncDto extends BulkProductIdsDto {
  @ApiProperty({ enum: Marketplace, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(Marketplace, { each: true })
  platforms!: Marketplace[];
}

export class ReorderProductImagesDto {
  @ApiProperty({ type: [String], description: 'Yeni sıra (URL listesi)' })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  imageUrls!: string[];
}

export class BulkVariantStockDeltaDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  variantIds!: string[];

  @ApiProperty({
    description: 'Stok değişimi (negatif = çıkar, pozitif = ekle)',
    example: 5,
  })
  @Type(() => Number)
  @IsInt()
  delta!: number;
}

export class BulkVariantActiveDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  variantIds!: string[];

  @ApiProperty()
  @IsBoolean()
  isActive!: boolean;
}

export class BulkVariantBarcodeDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  variantIds!: string[];
}

export class BulkVariantPriceUpdateDto {
  @ApiProperty({ enum: ['fixed', 'percentage', 'set'] })
  @IsIn(['fixed', 'percentage', 'set'])
  updateType!: 'fixed' | 'percentage' | 'set';

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  value!: number;

  @ApiPropertyOptional({ enum: ['increase', 'decrease'] })
  @IsOptional()
  @IsIn(['increase', 'decrease'])
  direction?: 'increase' | 'decrease';

  @ApiPropertyOptional({
    type: [String],
    description: 'Boşsa tüm varyantlar',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  variantIds?: string[];
}
