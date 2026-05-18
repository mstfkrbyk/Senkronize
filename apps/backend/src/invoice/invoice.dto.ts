import { ArrayMaxSize, IsArray, IsString, MaxLength, MinLength } from 'class-validator';

export class BulkInvoiceBodyDto {
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MinLength(8, { each: true })
  @MaxLength(64, { each: true })
  orderIds!: string[];
}
