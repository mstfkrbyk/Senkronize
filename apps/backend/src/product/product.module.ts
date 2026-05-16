import { Module } from '@nestjs/common';

import { ImageModule } from '../image/image.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [PrismaModule, ImageModule],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
