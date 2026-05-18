import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export type InAppNotificationListFilter =
  | 'all'
  | 'unread'
  | 'order'
  | 'stock'
  | 'error';

export class InAppNotificationListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(['all', 'unread', 'order', 'stock', 'error'])
  filter: InAppNotificationListFilter = 'all';
}
