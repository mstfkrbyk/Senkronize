import { BillingPeriod, PlanTier } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SubscriptionCheckoutDto {
  @IsEnum(PlanTier)
  plan!: PlanTier;
}

export class SubscriptionStartDto {
  @IsEnum(PlanTier)
  plan!: PlanTier;

  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;
}

export class IyzicoCallbackDto {
  @IsString()
  @MaxLength(256)
  token!: string;
}

export class SubscriptionChangePlanDto {
  @IsEnum(PlanTier)
  plan!: PlanTier;
}

export class SubscriptionCancelDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class TrialExtendDto {
  @IsString()
  organizationId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  days?: number = 7;
}

export class SubscriptionPaymentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
