import { ConflictResolution, ConflictType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

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
