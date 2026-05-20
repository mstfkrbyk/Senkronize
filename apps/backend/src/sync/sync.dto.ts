import {
  ConflictResolution,
  ConflictType,
  Marketplace,
  SyncLogStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ConflictListQueryDto {
  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsEnum(ConflictType)
  conflictType?: ConflictType;

  /** pending | resolved | ignored */
  @IsOptional()
  @IsString()
  status?: string;
}

export class ResolveConflictDto {
  @IsEnum(ConflictResolution)
  resolution!: ConflictResolution;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SyncLogListQueryDto {
  @IsOptional()
  @IsEnum(Marketplace)
  platform?: Marketplace;

  @IsOptional()
  @IsEnum(SyncLogStatus)
  status?: SyncLogStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
