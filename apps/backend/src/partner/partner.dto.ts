import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartnerStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
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
