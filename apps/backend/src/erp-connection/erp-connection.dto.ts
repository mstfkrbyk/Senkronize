import { ErpType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class CreateErpConnectionDto {
  @IsEnum(ErpType)
  erpType!: ErpType;

  @IsObject()
  credentials!: Record<string, string>;
}

export class TestErpConnectionDto {
  @IsOptional()
  @IsString()
  connectionId?: string;

  @ValidateIf((o: TestErpConnectionDto) => !o.connectionId)
  @IsEnum(ErpType)
  erpType?: ErpType;

  @ValidateIf((o: TestErpConnectionDto) => !o.connectionId)
  @IsObject()
  credentials?: Record<string, string>;
}

export class UpdateErpConnectionDto {
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
