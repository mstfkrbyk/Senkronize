import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

import { DIGEST_FREQUENCIES } from './notification.types';

export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailNewOrder?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailLowStock?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailStockOut?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailSyncError?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailWeeklyReport?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailTicketReply?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  emailPlanExpiry?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushNewOrder?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushLowStock?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  pushSyncError?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  inAppSoundEnabled?: boolean;

  @ApiPropertyOptional({ enum: DIGEST_FREQUENCIES })
  @IsOptional()
  @IsIn(DIGEST_FREQUENCIES)
  digestFrequency?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 23 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  digestHour?: number;
}
