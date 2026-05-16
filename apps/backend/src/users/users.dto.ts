import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

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

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ASSIGNABLE_ROLES })
  @IsIn(ASSIGNABLE_ROLES)
  role: UserRole;
}
