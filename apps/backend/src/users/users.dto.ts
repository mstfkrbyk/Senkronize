import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

const ASSIGNABLE_ROLES = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.VIEWER,
] as const;

export class InviteUserDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES)
  role: UserRole;
}

export class TransferOwnershipDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  newOwnerId: string;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES)
  role: UserRole;
}

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  newOrder?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  stockAlert?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  paymentAlert?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  syncError?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  smsEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;
}
