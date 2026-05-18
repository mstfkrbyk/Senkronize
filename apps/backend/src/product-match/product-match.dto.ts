import { IsNotEmpty, IsString } from 'class-validator';

export class ManualProductMatchDto {
  @IsString()
  @IsNotEmpty()
  listingId!: string;

  @IsString()
  @IsNotEmpty()
  masterProductId!: string;
}
