import { Type } from 'class-transformer';
import { IsNotEmpty, IsObject, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';

export class PushSubscriptionKeysDto {
  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  auth!: string;
}

export class SubscribePushDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  endpoint!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;
}

export class UnsubscribePushDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  endpoint?: string;
}
