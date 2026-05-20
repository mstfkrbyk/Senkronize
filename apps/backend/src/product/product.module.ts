import { Module } from '@nestjs/common';

import { ImageModule } from '../image/image.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StockModule } from '../stock/stock.module';
import { SyncModule } from '../sync/sync.module';
import { OutboundWebhookModule } from '../webhook/outbound-webhook.module';

import { ProductBulkService } from './product-bulk.service';
import { BarcodeService } from './barcode.service';
import { ProductController } from './product.controller';
import { ProductImageService } from './image.service';
import { ProductImportService } from './product-import.service';
import { ProductVariantService } from './product-variant.service';
import { ProductService } from './product.service';
import { VariantService } from './variant.service';

@Module({
  imports: [PrismaModule, ImageModule, OutboundWebhookModule, SyncModule, StockModule],
  controllers: [ProductController],
  providers: [
    ProductService,
    ProductVariantService,
    VariantService,
    ProductImageService,
    ProductImportService,
    ProductBulkService,
    BarcodeService,
  ],
  exports: [
    ProductService,
    ProductVariantService,
    VariantService,
    ProductImageService,
    ProductImportService,
    ProductBulkService,
    BarcodeService,
  ],
})
export class ProductModule {}
