import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Marketplace, PricingStrategy } from '@prisma/client';
import { Type } from 'class-transformer';
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
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
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

  @ApiPropertyOptional({ description: 'Zamanlanmış başlangıç (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @ApiPropertyOptional({ description: 'Zamanlanmış bitiş (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;

  @ApiPropertyOptional({
    description: 'Haftanın günleri (0=Pazar … 6=Cumartesi); boş = tüm günler',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @ApiPropertyOptional({ description: 'Başlangıç saati İstanbul (0–23)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  hoursStart?: number;

  @ApiPropertyOptional({ description: 'Bitiş saati İstanbul (0–23)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  hoursEnd?: number;

  @ApiPropertyOptional({ description: 'Kategori içerir filtresi' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  categoryFilter?: string;

  @ApiPropertyOptional({ description: 'Marka içerir filtresi' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  brandFilter?: string;

  @ApiPropertyOptional({ description: 'SKU / barkod regex deseni' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  skuPattern?: string;
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

  @ApiPropertyOptional({ description: 'Zamanlanmış başlangıç (ISO 8601)' })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsDateString()
  scheduledStart?: string | null;

  @ApiPropertyOptional({ description: 'Zamanlanmış bitiş (ISO 8601)' })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsDateString()
  scheduledEnd?: string | null;

  @ApiPropertyOptional({
    description: 'Haftanın günleri (0=Pazar … 6=Cumartesi); boş dizi = tüm günler',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @ApiPropertyOptional({ description: 'Başlangıç saati İstanbul (0–23)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  hoursStart?: number | null;

  @ApiPropertyOptional({ description: 'Bitiş saati İstanbul (0–23)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  hoursEnd?: number | null;

  @ApiPropertyOptional({ description: 'Kategori içerir filtresi' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  categoryFilter?: string | null;

  @ApiPropertyOptional({ description: 'Marka içerir filtresi' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  brandFilter?: string | null;

  @ApiPropertyOptional({ description: 'SKU / barkod regex deseni' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  skuPattern?: string | null;
}

export class SchedulePricingRuleDto {
  @ApiPropertyOptional({ description: 'Zamanlanmış başlangıç (ISO 8601)' })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsDateString()
  scheduledStart?: string | null;

  @ApiPropertyOptional({ description: 'Zamanlanmış bitiş (ISO 8601)' })
  @IsOptional()
  @ValidateIf((_, v) => v != null && v !== '')
  @IsDateString()
  scheduledEnd?: string | null;

  @ApiPropertyOptional({
    description: 'Haftanın günleri (0=Pazar … 6=Cumartesi)',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek?: number[];

  @ApiPropertyOptional({ description: 'Başlangıç saati İstanbul (0–23)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  hoursStart?: number | null;

  @ApiPropertyOptional({ description: 'Bitiş saati İstanbul (0–23)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(23)
  hoursEnd?: number | null;
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

export class SimulatePriceDto {
  @ApiProperty({ description: 'Listeleme kimliği' })
  @IsString()
  @IsNotEmpty()
  listingId!: string;

  @ApiProperty({ description: 'Simüle edilecek satış fiyatı (TRY)' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  salePrice!: number;

  @ApiPropertyOptional({ description: 'Maliyet (TRY); boşsa ürün maliyeti kullanılır' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number;
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

export class CreatePriceAlertDto {
  @ApiProperty({ description: 'Listeleme kimliği' })
  @IsString()
  @IsNotEmpty()
  listingId!: string;

  @ApiProperty({ description: 'Eşik fiyat (TRY)' })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  thresholdPrice!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  notifyEmail?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  notifyInApp?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  notifySms?: boolean;
}
