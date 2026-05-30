import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartnerStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class InviteClientDto {
  @ApiProperty({ description: 'Davet edilecek müşteri e-postası' })
  @IsEmail()
  clientEmail!: string;

  @ApiPropertyOptional({ description: 'Komisyon oranı %', minimum: 0, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50)
  commissionPct?: number;

  @ApiPropertyOptional({ description: 'Müşteri adına oturum açma izni' })
  @IsOptional()
  @IsBoolean()
  canImpersonate?: boolean;
}

export class AcceptInviteDto {
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  inviteToken!: string;
}

export class UpdateRelationshipDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50)
  commissionPct?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  canImpersonate?: boolean;

  @ApiPropertyOptional({ enum: PartnerStatus })
  @IsOptional()
  @IsEnum(PartnerStatus)
  status?: PartnerStatus;
}

export class PartnerOnboardingInviteDto {
  @ApiProperty({ description: 'Davet edilecek müşteri e-postası' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ description: 'Davet e-postasına eklenecek kısa mesaj', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class ValidatePartnerInviteDto {
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  token!: string;
}

export class UpdateWhiteLabelDto {
  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  brandName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'Geçerli bir logo URL’si girin' })
  @MaxLength(2000)
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Örn. #0ea5e9' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  primaryColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  supportPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customDomain?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  hideSenkronize?: boolean;
}

export class PartnerPayoutRequestDto {
  @ApiProperty({ description: 'Talep edilen tutar (TRY)', minimum: 1 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Max(50_000_000)
  amount!: number;
}

export class AdminPartnerPayoutQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export class RejectPartnerPayoutDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class PartnerLinkRequestDto {
  @ApiProperty({ description: 'Bağlanılacak partner organizasyon kimliği' })
  @IsString()
  @MinLength(10)
  partnerOrgId!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export class RejectPartnerLinkRequestDto {
  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class UpdatePartnerCommissionRateDto {
  @ApiProperty({ description: 'Komisyon oranı (%)', minimum: 0, maximum: 50 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(50)
  rate!: number;
}
