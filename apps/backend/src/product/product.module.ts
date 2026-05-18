import { Module } from '@nestjs/common';

import { ImageModule } from '../image/image.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OutboundWebhookModule } from '../webhook/outbound-webhook.module';

import { ProductController } from './product.controller';
import { ProductImportService } from './product-import.service';
import { ProductVariantService } from './product-variant.service';
import { ProductService } from './product.service';

@Module({
  imports: [PrismaModule, ImageModule, OutboundWebhookModule],
  controllers: [ProductController],
  providers: [ProductService, ProductVariantService, ProductImportService],
  exports: [ProductService, ProductVariantService, ProductImportService],
})
export class ProductModule {}
