import { IntegrationPolicyCategory, SyncFrequency } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdateIntegrationPolicyDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  orderSyncIntervalMinutes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  orderLookbackMinutes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  listingSyncIntervalMinutes?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  listingSyncHour?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3600)
  maxRequestsPerHour?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  requestsPerMinute?: number | null;

  @IsOptional()
  @IsEnum(SyncFrequency)
  syncFrequency?: SyncFrequency | null;
}

export class IntegrationPlatformParamDto {
  platformKey!: string;
}

export { IntegrationPolicyCategory };
