import { Marketplace } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
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
