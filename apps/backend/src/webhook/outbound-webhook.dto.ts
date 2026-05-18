import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Panel ve doğrulama için desteklenen giden olay adları */
export const OUTBOUND_WEBHOOK_EVENT_OPTIONS = [
  'order.created',
  'order.status_changed',
  'stock.updated',
  'product.updated',
] as const;

export type OutboundWebhookEventId = (typeof OUTBOUND_WEBHOOK_EVENT_OPTIONS)[number];

export class CreateWebhookEndpointDto {
  @ApiProperty({ example: 'Üretim ERP' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: 'https://example.com/hooks/senkronize' })
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url!: string;

  @ApiProperty({ type: [String], example: ['order.created', 'stock.updated'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  events!: string[];

  @ApiPropertyOptional({
    description:
      'Boş bırakılırsa rastgele HMAC secret üretilir. Yalnızca oluşturma anında tam değer döner.',
  })
  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  secret?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 3, minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  retryCount?: number;

  @ApiPropertyOptional({ default: 5000, minimum: 1000, maximum: 60000 })
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(60_000)
  timeoutMs?: number;
}

export class UpdateWebhookEndpointDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  url?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  events?: string[];

  @ApiPropertyOptional({
    description: 'Yeni HMAC secret (mevcut imzayı geçersiz kılar)',
  })
  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(256)
  secret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  retryCount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1000)
  @Max(60_000)
  timeoutMs?: number;
}

export class WebhookEndpointSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  organizationId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty({ type: [String] })
  events!: string[];

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  retryCount!: number;

  @ApiProperty()
  timeoutMs!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class WebhookEndpointCreatedDto extends WebhookEndpointSummaryDto {
  @ApiProperty({
    description: 'HMAC imza anahtarı — yalnızca oluşturma yanıtında döner',
  })
  secret!: string;
}
