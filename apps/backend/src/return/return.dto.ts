import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { Marketplace, ReturnStatus } from '@prisma/client';

export class ReturnQueryDto {
  @IsOptional()
  @IsEnum(Marketplace)
  platform?: Marketplace;

  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(String(value), 10))
  limit?: number;
}

export class SyncReturnsDto {
  @IsString()
  @IsNotEmpty()
  connectionId!: string;
}

export class RejectReturnDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class UpdateReturnStatusDto {
  @IsEnum(ReturnStatus)
  status!: ReturnStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
