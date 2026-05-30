import { Marketplace } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

import type { ProductMatchKey } from '../common/product-match-key';

export class CreateConnectionDto {
  @IsEnum(Marketplace)
  platform!: Marketplace;

  @IsObject()
  credentials!: Record<string, string>;
}

export class TestConnectionDto {
  @IsOptional()
  @IsString()
  connectionId?: string;

  @ValidateIf((o: TestConnectionDto) => !o.connectionId)
  @IsEnum(Marketplace)
  platform?: Marketplace;

  @ValidateIf((o: TestConnectionDto) => !o.connectionId)
  @IsObject()
  credentials?: Record<string, string>;
}

export class UpdateConnectionDto {
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** null = organizasyon varsayılanını kullan */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(['BARCODE', 'SKU', 'MANUAL'], {
    message: 'productMatchKey BARCODE, SKU, MANUAL veya null olmalıdır.',
  })
  productMatchKey?: ProductMatchKey | null;

  /** Platforma stok push */
  @IsOptional()
  @IsBoolean()
  pushStock?: boolean;

  /** Platforma fiyat push */
  @IsOptional()
  @IsBoolean()
  pushPrice?: boolean;
}
