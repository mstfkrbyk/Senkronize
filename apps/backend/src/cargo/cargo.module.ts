import { Module } from '@nestjs/common';

import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CargoController } from './cargo.controller';
import { CargoRateService } from './cargo-rate.service';
import { CargoService } from './cargo.service';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [CargoController],
  providers: [CargoService, CargoRateService],
  exports: [CargoService],
})
export class CargoModule {}
