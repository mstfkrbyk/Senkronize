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
  syncPrices?: boolean;

  @IsOptional()
  @IsBoolean()
  syncInvoices?: boolean;

  @IsOptional()
  @IsBoolean()
  syncCustomers?: boolean;

  @IsOptional()
  @IsBoolean()
  autoCreateInvoice?: boolean;
}

export class PatchErpSyncSettingsDto {
  @IsOptional()
  @IsEnum(SyncFrequency)
  syncFrequency?: SyncFrequency;

  @IsOptional()
  @IsBoolean()
  syncStock?: boolean;

  @IsOptional()
  @IsBoolean()
  syncProducts?: boolean;

  @IsOptional()
  @IsBoolean()
  syncPrices?: boolean;

  @IsOptional()
  @IsBoolean()
  syncInvoices?: boolean;

  @IsOptional()
  @IsBoolean()
  syncCustomers?: boolean;

  @IsOptional()
  @IsBoolean()
  autoCreateInvoice?: boolean;
}
