import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const API_KEY_PERMISSIONS = [
  'orders:read',
  'orders:write',
  'products:read',
  'products:write',
  'stock:read',
  'stock:write',
  'webhooks:manage',
] as const;

export type ApiKeyPermission = (typeof API_KEY_PERMISSIONS)[number];

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Tauri masaüstü ajanı' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    description: 'İzin kapsamı',
    type: [String],
    example: ['orders:read', 'products:read'],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(API_KEY_PERMISSIONS, { each: true })
  permissions?: ApiKeyPermission[];

  @ApiPropertyOptional({
    description: 'Son kullanım tarihi (ISO 8601)',
    example: '2027-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ApiKeyListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  keyPrefix!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastUsedAt!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  expiresAt!: string | null;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class CreatedApiKeyResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({
    description: 'Gösterim için kayıtlı önek (tam anahtarın ilk 12 karakteri, örn. sk_live_xxxx)',
  })
  keyPrefix!: string;

  @ApiProperty({
    description: 'Tam gizli anahtar — yalnızca oluşturma anında döner',
  })
  key!: string;
}
