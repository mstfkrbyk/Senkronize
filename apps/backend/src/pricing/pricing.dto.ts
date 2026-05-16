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
