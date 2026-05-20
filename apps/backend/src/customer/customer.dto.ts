import { Marketplace } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import type { CustomerSegmentKey } from './customer.types';

export class CustomerQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsEnum(Marketplace)
  platform?: Marketplace;

  @IsOptional()
  @IsIn(['VIP', 'sadik', 'yeni', 'risk', 'kayip'])
  segment?: CustomerSegmentKey;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  tag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  startDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSpent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxSpent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOrders?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxOrders?: number;
}

export class CustomerBulkTagsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(200)
  customerIds!: string[];

  @IsIn(['add', 'remove'])
  action!: 'add' | 'remove';

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  tag!: string;
}

export class CustomerUpdateDto {
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string;
}

export class CustomerTagsDto {
  @IsIn(['add', 'remove'])
  action!: 'add' | 'remove';

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  tag!: string;
}

export class CustomerNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  note!: string;
}
