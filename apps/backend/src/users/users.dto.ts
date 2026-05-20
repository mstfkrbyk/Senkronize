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

export class UpdatePanelPreferencesDto {
  @ApiPropertyOptional({ enum: ['light', 'dark', 'system'] })
  @IsOptional()
  @IsIn(['light', 'dark', 'system'])
  theme?: 'light' | 'dark' | 'system';

  @ApiPropertyOptional({ enum: ['tr', 'en'] })
  @IsOptional()
  @IsIn(['tr', 'en'])
  language?: 'tr' | 'en';

  @ApiPropertyOptional({ example: 'Europe/Istanbul' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ enum: ['DD/MM/YYYY', 'MM/DD/YYYY'] })
  @IsOptional()
  @IsIn(['DD/MM/YYYY', 'MM/DD/YYYY'])
  dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY';

  @ApiPropertyOptional({ enum: ['tr-TR', 'en-US'] })
  @IsOptional()
  @IsIn(['tr-TR', 'en-US'])
  currencyFormat?: 'tr-TR' | 'en-US';

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sidebarCollapsedDefault?: boolean;
}
