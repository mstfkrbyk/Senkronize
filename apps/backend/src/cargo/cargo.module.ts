import { Module } from '@nestjs/common';

import { CommonModule } from '../common/common.module';
import { PrismaModule } from '../prisma/prisma.module';

import { CargoController } from './cargo.controller';
import { CargoService } from './cargo.service';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [CargoController],
  providers: [CargoService],
  exports: [CargoService],
})
export class CargoModule {}
