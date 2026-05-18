import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class ConvertCurrencyDto {
  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Za-z]{3}$/)
  from!: string;

  @ApiProperty({ example: 'TRY' })
  @IsString()
  @MaxLength(3)
  @Matches(/^[A-Za-z]{3}$/)
  to!: string;

  @ApiPropertyOptional({ description: 'Kur tarihi (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  date?: string;
}
