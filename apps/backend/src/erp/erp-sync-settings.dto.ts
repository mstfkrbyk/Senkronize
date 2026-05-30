import { ErpProductImportMode, SyncFrequency } from '@prisma/client';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpsertErpSyncSettingsDto {
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

  @IsOptional()
  @IsEnum(ErpProductImportMode)
  productImportMode?: ErpProductImportMode;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  erpCategoryIds?: string[];
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

  @IsOptional()
  @IsEnum(ErpProductImportMode)
  productImportMode?: ErpProductImportMode;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  erpCategoryIds?: string[];
}
