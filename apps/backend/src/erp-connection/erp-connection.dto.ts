import { ErpType, ErpConnectionRole } from '@prisma/client';
import { IsBoolean, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

import type { ProductMatchKey } from '../common/product-match-key';

export class CreateErpConnectionDto {
  @IsEnum(ErpType)
  erpType!: ErpType;

  @IsObject()
  credentials!: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  /** İlk bağlantıda varsayılan PRIMARY; ikincide SECONDARY */
  @IsOptional()
  @IsEnum(ErpConnectionRole)
  role?: ErpConnectionRole;
}

export class UpdateErpConnectionDto {
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  /** null = organizasyon varsayılanını kullan */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(['BARCODE', 'SKU', 'MANUAL'], {
    message: 'productMatchKey BARCODE, SKU, MANUAL veya null olmalıdır.',
  })
  productMatchKey?: ProductMatchKey | null;
}

export class TestErpConnectionDto {
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @IsOptional()
  @IsEnum(ErpType)
  erpType?: ErpType;

  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
}

export enum ErpManualSyncType {
  ALL = 'all',
  PRODUCTS = 'products',
  STOCK = 'stock',
  INVOICES = 'invoices',
  CUSTOMERS = 'customers',
}

export class ErpManualSyncDto {
  @IsEnum(ErpManualSyncType)
  @IsNotEmpty()
  type!: ErpManualSyncType;
}
