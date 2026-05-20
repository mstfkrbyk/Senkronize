import { SyncFrequency } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpsertErpSyncSettingsDto {
  @IsEnum(SyncFrequency)
  syncFrequency!: SyncFrequency;

  @IsOptional()
  @IsBoolean()
  syncStock?: boolean;

  @IsOptional()
  @IsBoolean()
  syncProducts?: boolean;

  @IsOptional()
  @IsBoolean()
  syncInvoices?: boolean;
}
