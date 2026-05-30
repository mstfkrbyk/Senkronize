import { AccountingMode, PlanTier, SubStatus, UserRole } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminOrganizationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(PlanTier)
  plan?: PlanTier;

  @IsOptional()
  @IsIn(['AKTIF', 'DENEME', 'ASKIDA'])
  status?: 'AKTIF' | 'DENEME' | 'ASKIDA';

  @IsOptional()
  @IsIn(['INTEGRATION', 'ACCOUNTING', 'BUNDLE'])
  product?: 'INTEGRATION' | 'ACCOUNTING' | 'BUNDLE';

  @IsOptional()
  @IsEnum(AccountingMode)
  accountingMode?: AccountingMode;

  /** Aktif partner bağlantısı olan müşteri org'larını filtreler */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  partner?: string;
}

export class SuspendOrganizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class GrowthStatsQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d'])
  period?: '7d' | '30d' | '90d';
}

export class AdminPlatformStatsQueryDto {
  @IsOptional()
  @IsIn(['INTEGRATION', 'ACCOUNTING', 'BUNDLE'])
  product?: 'INTEGRATION' | 'ACCOUNTING' | 'BUNDLE';
}

export class ChangeOrganizationPlanDto {
  @IsEnum(PlanTier)
  plan!: PlanTier;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class ChangeOrganizationSubscriptionDto {
  @IsOptional()
  @IsEnum(SubStatus)
  status?: SubStatus;

  @IsOptional()
  @IsDateString()
  trialEndsAt?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class ChangeOrganizationProductLinesDto {
  @IsIn(['INTEGRATION', 'ACCOUNTING', 'BUNDLE'])
  productSelection!: 'INTEGRATION' | 'ACCOUNTING' | 'BUNDLE';

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class ChangeOrganizationAccountingModeDto {
  @IsEnum(AccountingMode, {
    message: 'accountingMode NATIVE veya EXTERNAL_ERP olmalıdır.',
  })
  accountingMode!: AccountingMode;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class AssignOrganizationPartnerDto {
  @IsString()
  @IsNotEmpty()
  partnerOrgId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class AdminSubscriptionsQueryDto {
  @IsOptional()
  @IsEnum(SubStatus)
  status?: SubStatus;
}

export class BlockedIpMutationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  ip!: string;

  @IsBoolean()
  blocked!: boolean;
}

export class AdminUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  orgId?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsIn(['INTEGRATION', 'ACCOUNTING', 'BUNDLE'])
  product?: 'INTEGRATION' | 'ACCOUNTING' | 'BUNDLE';
}

export class ChangeAdminUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}

export class AddOrgNoteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  note!: string;
}

export class ConfigureInternalAccountDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsEnum(PlanTier)
  plan?: PlanTier;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

export class UpdateAdminUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}

export class UpdateAdminOrganizationInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  taxOffice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string;
}

export class GrantExtraErpSlotDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  quantity!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}
