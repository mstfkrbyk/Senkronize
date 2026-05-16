import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class BulkStockUpdateItemDto {
  @IsString()
  @IsNotEmpty()
  barcode!: string;

  @IsInt()
  @Min(0)
  quantity!: number;
}

export class BulkStockUpdateDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkStockUpdateItemDto)
  updates!: BulkStockUpdateItemDto[];
}
