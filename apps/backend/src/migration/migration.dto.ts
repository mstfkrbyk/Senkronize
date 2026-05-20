import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

import type { MigrationDataType } from './migration.types';

export class MigrationUploadQueryDto {
  @IsEnum(['products', 'orders', 'stock_movements', 'customers'])
  dataType!: MigrationDataType;

  @IsOptional()
  @IsString()
  sourceFormat?: string;
}

export class MigrationMapDto {
  @IsObject()
  @IsNotEmpty()
  columnMapping!: Record<string, string>;
}
