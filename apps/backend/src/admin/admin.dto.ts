import { SubStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class UpdateOrgStatusDto {
  @IsBoolean()
  suspended!: boolean;
}

export class AdminSubscriptionsQueryDto {
  @IsOptional()
  @IsEnum(SubStatus)
  status?: SubStatus;
}
