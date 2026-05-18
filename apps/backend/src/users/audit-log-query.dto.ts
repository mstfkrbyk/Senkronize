import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AuditLogQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  /** Örn. `sync_*` → `sync_` ile başlayan kayıtlar */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  action?: string;

  /** Sync / kuyruk hataları (sync_* ve ilgili queue.job_failed) */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true || value === '1')
  @IsBoolean()
  syncOnly?: boolean;
}
