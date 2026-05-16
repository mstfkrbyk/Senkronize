import { IsBoolean, IsEnum, IsObject, IsOptional } from 'class-validator';
import { Marketplace } from '@prisma/client';

export class CreateConnectionDto {
  @IsEnum(Marketplace)
  platform!: Marketplace;

  @IsObject()
  credentials!: Record<string, string>;
}

export class TestConnectionDto {
  @IsEnum(Marketplace)
  platform!: Marketplace;

  @IsObject()
  credentials!: Record<string, string>;
}

export class UpdateConnectionDto {
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
