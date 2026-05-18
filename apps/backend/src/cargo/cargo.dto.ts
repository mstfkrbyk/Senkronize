import { CargoProvider } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
