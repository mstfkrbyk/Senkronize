import { ErpType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsObject, IsOptional, IsUUID } from 'class-validator';

export class CreateErpConnectionDto {
  @IsEnum(ErpType)
  erpType!: ErpType;

  @IsObject()
  credentials!: Record<string, string>;
}

export class UpdateErpConnectionDto {
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;

  @IsOptional()
  isActive?: boolean;
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
