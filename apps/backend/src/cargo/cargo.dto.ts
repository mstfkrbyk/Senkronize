import { CargoProvider } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCargoShipmentDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsEnum(CargoProvider)
  cargoProvider!: CargoProvider;
}

export class CargoShipmentQueryDto {
  @IsOptional()
  @IsEnum(CargoProvider)
  cargoProvider?: CargoProvider;
}

export class CompareCargoRatesDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  weightKg?: number;
}

export class OptimalCarrierQueryDto {
  @IsString()
  @IsNotEmpty()
  orderId!: string;
}
