import { PlanTier, SubStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminOrganizationsQueryDto {
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

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(PlanTier)
  plan?: PlanTier;

  @IsOptional()
  @IsIn(['AKTIF', 'DENEME', 'ASKIDA'])
  status?: 'AKTIF' | 'DENEME' | 'ASKIDA';
}

export class SuspendOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class ChangeOrganizationPlanDto {
  @IsEnum(PlanTier)
  plan!: PlanTier;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class AdminSubscriptionsQueryDto {
  @IsOptional()
  @IsEnum(SubStatus)
  status?: SubStatus;
}
