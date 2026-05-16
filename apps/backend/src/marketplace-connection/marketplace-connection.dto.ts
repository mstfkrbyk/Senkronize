import { Marketplace } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

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
}
