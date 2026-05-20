import { Marketplace } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
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
  @IsIn(['VIP', 'sadik', 'yeni', 'riskAlti'])
  segment?: CustomerSegmentKey;

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
