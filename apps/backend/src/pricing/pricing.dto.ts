import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Marketplace, PricingStrategy } from '@prisma/client';
import { Type } from 'class-transformer';
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
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePricingRuleDto {
  @ApiProperty({ example: 'BuyBox eşitleme' })
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: Marketplace })
  @IsEnum(Marketplace)
  platform!: Marketplace;

  @ApiProperty({ enum: PricingStrategy })
  @IsEnum(PricingStrategy)
  strategy!: PricingStrategy;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minMarginPct?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  maxDiscountPct?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  targetPosition?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  applyToAll?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  barcodes?: string[];

  @ApiPropertyOptional({ description: 'Maliyet fiyatı (TRY)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({
    description: 'Minimum kâr marjı oranı (0.10 = %10); boşsa minMarginPct kullanılır',
    minimum: 0,
    maximum: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  minMarginPercent?: number;

  @ApiPropertyOptional({ description: 'Rakip fiyatından düşülecek adım (TRY)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stepAmount?: number;

  @ApiPropertyOptional({ description: 'Gece indirim oranı (0.05 = %5)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  nightDiscountPercent?: number;

  @ApiPropertyOptional({ description: 'Peak saat prim oranı (0.03 = %3)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  peakPremiumPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  highStockThreshold?: number;

  @ApiPropertyOptional({ description: 'Tavan fiyat (TRY)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;
}

export class UpdatePricingRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: Marketplace })
  @IsOptional()
  @IsEnum(Marketplace)
  platform?: Marketplace;

  @ApiPropertyOptional({ enum: PricingStrategy })
  @IsOptional()
  @IsEnum(PricingStrategy)
  strategy?: PricingStrategy;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minMarginPct?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  maxDiscountPct?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  targetPosition?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  applyToAll?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  barcodes?: string[];

  @ApiPropertyOptional({ description: 'Maliyet fiyatı (TRY)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({
    description: 'Minimum kâr marjı oranı (0.10 = %10); boşsa minMarginPct kullanılır',
    minimum: 0,
    maximum: 2,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2)
  minMarginPercent?: number;

  @ApiPropertyOptional({ description: 'Rakip fiyatından düşülecek adım (TRY)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stepAmount?: number;

  @ApiPropertyOptional({ description: 'Gece indirim oranı (0.05 = %5)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  nightDiscountPercent?: number;

  @ApiPropertyOptional({ description: 'Peak saat prim oranı (0.03 = %3)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  peakPremiumPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  highStockThreshold?: number;

  @ApiPropertyOptional({ description: 'Tavan fiyat (TRY)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;
}

export class SimulatePricingRuleDto {
  @ApiProperty({ description: 'Mevcut satış fiyatı' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  currentPrice!: number;

  @ApiPropertyOptional({ description: 'BuyBox / rakip referans fiyatı' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  competitorPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ description: 'BuyBox kazanan mısınız' })
  @IsOptional()
  @IsBoolean()
  hasBuyBox?: boolean;
}

export class ManualPriceUpdateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  barcode!: string;

  @ApiProperty({ enum: Marketplace })
  @IsEnum(Marketplace)
  platform!: Marketplace;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  salePrice!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  listPrice!: number;
}

export class PricingPlatformQueryDto {
  @ApiPropertyOptional({ enum: Marketplace })
  @IsOptional()
  @IsEnum(Marketplace)
  platform?: Marketplace;
}

export class PriceHistoryQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ enum: Marketplace })
  @IsOptional()
  @IsEnum(Marketplace)
  platform?: Marketplace;
}
