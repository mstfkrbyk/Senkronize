import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Tauri masaüstü ajanı' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
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
