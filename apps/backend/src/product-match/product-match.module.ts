import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { ProductMatchController } from './product-match.controller';
import { ProductMatchService } from './product-match.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProductMatchController],
  providers: [ProductMatchService],
  exports: [ProductMatchService],
})
export class ProductMatchModule {}
