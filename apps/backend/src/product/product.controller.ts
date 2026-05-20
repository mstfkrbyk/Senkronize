import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  ParseIntPipe,
  Query,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Product } from '@prisma/client';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImageService } from '../image/image.service';

import type { ProductAnalyticsResponse } from './product-analytics.types';
import {
  BulkCategoryAssignDto,
  BulkPlatformSyncDto,
  BulkPriceUpdateDto,
  BulkProductIdsDto,
  BulkStockUpdateDto,
  BulkVariantPriceUpdateDto,
  ReorderProductImagesDto,
} from './product-bulk.dto';
import { ProductBulkService } from './product-bulk.service';
import type { ImportResult } from './product-import.types';
import { ProductImportService } from './product-import.service';
import {
  BulkUpsertVariantsDto,
  CreateVariantDto,
  UpdateVariantDto,
} from './product-variant.dto';
import { ProductVariantService } from './product-variant.service';
import {
  CreateProductDto,
  ProductQueryDto,
  SyncAllPlatformsDto,
  UpdateProductDto,
  UpdateProductReorderDto,
} from './product.dto';
import {
  type ProductDetailPayload,
  type ProductListItem,
  type ReorderAlertRow,
  ProductService,
} from './product.service';

const PRODUCT_IMAGE_LIMIT = 5 * 1024 * 1024;
const CSV_MAX_BYTES = 10 * 1024 * 1024;
const CSV_MIMES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/octet-stream',
]);
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly productVariantService: ProductVariantService,
    private readonly productImportService: ProductImportService,
    private readonly productBulkService: ProductBulkService,
    private readonly imageService: ImageService,
  ) {}

  @Get('reorder-alerts')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Min stok eşiğinin altındaki ürünler' })
  @ApiResponse({ status: 200 })
  async getReorderAlerts(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ data: ReorderAlertRow[] }> {
    const data = await this.productService.getReorderAlerts(org.id);
    return { data };
  }

  @Get('barcodes')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Barkod listesi (stok senkronu için)' })
  @ApiResponse({ status: 200, description: 'Barkodlar' })
  async listBarcodes(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ items: string[] }> {
    const items = await this.productService.listBarcodes(org.id);
    return { items };
  }

  @Post('sync-all-platforms')
  @Throttle({ default: { limit: 10 } })
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Tüm aktif pazaryeri bağlantılarında stok/fiyat kuyruğa' })
  @ApiResponse({ status: 200, description: 'Kuyruğa eklenen bağlantı sayısı' })
  async syncAllPlatforms(
    @Body() dto: SyncAllPlatformsDto,
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<{ queued: number }> {
    return this.productService.syncToPlatforms(org.id, dto);
  }

  @Get('template')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürün ve varyant CSV şablonu indir' })
  @ApiResponse({ status: 200, description: 'CSV şablonu' })
  async downloadTemplate(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<StreamableFile> {
    void org.id;
    const csv = await this.productImportService.exportProductTemplateCsv();
    return new StreamableFile(Buffer.from(csv, 'utf-8'), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="senkronize-urun-varyant-sablonu.csv"',
    });
  }

  @Get('import/template')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Basit ürün içe aktarma CSV şablonu' })
  @ApiResponse({ status: 200, description: 'CSV şablonu' })
  async downloadImportTemplate(
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<StreamableFile> {
    void org.id;
    const csv = await this.productImportService.exportSimpleImportTemplateCsv();
    return new StreamableFile(Buffer.from(csv, 'utf-8'), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="urun-sablonu.csv"',
    });
  }

  @Get('export')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürünleri CSV olarak dışa aktar' })
  @ApiResponse({ status: 200, description: 'CSV dosyası' })
  async exportProducts(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query('ids') ids?: string,
    @Query('columns') columns?: string,
  ): Promise<StreamableFile> {
    const productIds = ids
      ?.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const columnList = columns
      ?.split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const csv = await this.productImportService.exportProductsToCsv(org.id, {
      productIds,
      columns: columnList,
    });
    const body = csv.startsWith('\uFEFF') ? csv : `\uFEFF${csv}`;
    return new StreamableFile(Buffer.from(body, 'utf-8'), {
      type: 'text/csv; charset=utf-8',
      disposition: 'attachment; filename="urunler.csv"',
    });
  }

  @Post('bulk/price')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Seçili ürünlerin listing fiyatlarını toplu güncelle' })
  async bulkPrice(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkPriceUpdateDto,
  ): Promise<{ updated: number; previewCount: number }> {
    return this.productBulkService.bulkUpdatePrices(org.id, dto);
  }

  @Post('bulk/stock')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Seçili ürün varyant stoklarını toplu güncelle' })
  async bulkStock(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkStockUpdateDto,
  ): Promise<{ updated: number }> {
    return this.productBulkService.bulkUpdateStock(org.id, dto);
  }

  @Post('bulk/category')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Seçili ürünlere kategori ata' })
  async bulkCategory(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkCategoryAssignDto,
  ): Promise<{ updated: number }> {
    return this.productBulkService.bulkAssignCategory(org.id, dto);
  }

  @Post('bulk/delete')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Seçili ürünleri sil (soft delete)' })
  async bulkDelete(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkProductIdsDto,
  ): Promise<{ deleted: number }> {
    return this.productBulkService.bulkDelete(org.id, dto.productIds);
  }

  @Post('bulk/sync-platforms')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Seçili ürünleri pazaryerlerine gönder' })
  async bulkSyncPlatforms(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: BulkPlatformSyncDto,
  ): Promise<{ queued: number }> {
    return this.productBulkService.bulkSyncPlatforms(org.id, dto);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CSV_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        const mime = (file.mimetype ?? '').toLowerCase();
        if (mime.length === 0 || CSV_MIMES.has(mime)) {
          cb(null, true);
          return;
        }
        cb(
          new BadRequestException(
            'Geçersiz dosya türü. Yalnızca CSV dosyası yükleyebilirsiniz.',
          ),
          false,
        );
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'CSV ile ürün içe aktar' })
  @ApiResponse({ status: 201, description: 'Özet' })
  async importProducts(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentOrg() org: CurrentOrgPayload,
  ): Promise<ImportResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('CSV dosyası gerekli');
    }
    return this.productImportService.importProductsFromCsv(org.id, file.buffer);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürün kataloğu listesi' })
  @ApiResponse({ status: 200, description: 'Sayfalı liste' })
  async findAll(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: ProductQueryDto,
  ): Promise<{ items: ProductListItem[]; total: number }> {
    return this.productService.findAll(org.id, query);
  }

  @Get(':id/detail')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürün detayı (varyant, listeleme, stok)' })
  @ApiResponse({ status: 200, description: 'Detay' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async getDetail(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<ProductDetailPayload> {
    return this.productService.getProductDetail(org.id, id);
  }

  @Get(':id/analytics')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürün satış ve fiyat analitiği' })
  async getAnalytics(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ): Promise<ProductAnalyticsResponse> {
    const safeDays = Math.min(365, Math.max(1, days));
    return this.productService.getProductAnalytics(org.id, id, safeDays);
  }

  @Post(':id/images/reorder')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürün görsellerinin sırasını güncelle' })
  async reorderImages(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: ReorderProductImagesDto,
  ): Promise<Product> {
    return this.productService.reorderImages(org.id, id, dto.imageUrls);
  }

  @Delete(':id/images/:imageIndex')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürün görselini sil' })
  async deleteImage(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Param('imageIndex', ParseIntPipe) imageIndex: number,
  ): Promise<Product> {
    return this.productService.removeImageAtIndex(org.id, id, imageIndex);
  }

  @Get(':id/variants')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürün varyantları' })
  @ApiResponse({ status: 200, description: 'Varyant listesi' })
  async listVariants(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ) {
    return this.productVariantService.getVariantsByProduct(org.id, id);
  }

  @Post(':id/variants/bulk')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Varyant toplu upsert (CSV senkronu)' })
  @ApiResponse({ status: 200, description: 'Özet' })
  async bulkVariants(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: BulkUpsertVariantsDto,
  ): Promise<{ created: number; updated: number }> {
    return this.productVariantService.bulkUpsertVariants(
      org.id,
      id,
      dto.variants,
    );
  }

  @Post(':id/variants/import')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: CSV_MAX_BYTES },
      fileFilter: (_req, file, cb) => {
        const mime = (file.mimetype ?? '').toLowerCase();
        if (mime.length === 0 || CSV_MIMES.has(mime)) {
          cb(null, true);
          return;
        }
        cb(
          new BadRequestException(
            'Geçersiz dosya türü. Yalnızca CSV dosyası yükleyebilirsiniz.',
          ),
          false,
        );
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'CSV ile varyant içe aktar' })
  @ApiResponse({ status: 201, description: 'Özet' })
  async importVariants(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<ImportResult> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('CSV dosyası gerekli');
    }
    return this.productImportService.importVariantsFromCsv(
      org.id,
      id,
      file.buffer,
    );
  }

  @Post(':id/variants')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Yeni varyant oluştur' })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  async createVariant(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: CreateVariantDto,
  ) {
    return this.productVariantService.createVariant(org.id, id, dto);
  }

  @Patch(':id/variants/bulk-price')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Varyant fiyatlarını toplu güncelle' })
  async bulkVariantPrice(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: BulkVariantPriceUpdateDto,
  ): Promise<{ updated: number }> {
    return this.productVariantService.bulkUpdateVariantPrices(
      org.id,
      id,
      dto,
    );
  }

  @Patch(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Varyant güncelle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  async updateVariant(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.productVariantService.updateVariant(org.id, variantId, dto);
  }

  @Delete(':id/variants/:variantId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Varyantı sil (soft delete)' })
  @ApiResponse({ status: 200, description: 'Silindi' })
  async deleteVariant(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('variantId') variantId: string,
  ): Promise<{ ok: true }> {
    await this.productVariantService.deleteVariant(org.id, variantId);
    return { ok: true };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürün detayı' })
  @ApiResponse({ status: 200, description: 'Ürün' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async findOne(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<Product> {
    return this.productService.findOne(org.id, id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Yeni ürün oluştur' })
  @ApiResponse({ status: 201, description: 'Oluşturuldu' })
  @ApiResponse({ status: 409, description: 'Barkod çakışması' })
  async create(
    @CurrentOrg() org: CurrentOrgPayload,
    @Body() dto: CreateProductDto,
  ): Promise<Product> {
    return this.productService.create(org.id, dto);
  }

  @Patch(':id/reorder')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Otomatik sipariş eşiği (min stok, sipariş miktarı, tedarik süresi)' })
  @ApiResponse({ status: 200 })
  async patchReorder(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductReorderDto,
  ): Promise<Product> {
    return this.productService.patchReorderSettings(org.id, id, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürün güncelle' })
  @ApiResponse({ status: 200, description: 'Güncellendi' })
  @ApiResponse({ status: 404, description: 'Bulunamadı' })
  async update(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ): Promise<Product> {
    return this.productService.update(org.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürünü pasifleştir (soft delete)' })
  @ApiResponse({ status: 200, description: 'Silindi' })
  async remove(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.productService.softDelete(org.id, id);
    return { ok: true };
  }

  @Post(':id/image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PRODUCT_IMAGE_LIMIT },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIMES.includes(file.mimetype as (typeof ALLOWED_MIMES)[number])) {
          cb(
            new BadRequestException(
              'Geçersiz dosya türü. Yalnızca JPG, PNG veya WebP yükleyebilirsiniz.',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Ürün görseli yükle' })
  @ApiResponse({ status: 201, description: 'Yüklendi' })
  @ApiResponse({ status: 404, description: 'Ürün bulunamadı' })
  async uploadImage(
    @CurrentOrg() org: CurrentOrgPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    await this.productService.findOne(org.id, id);
    if (!file?.buffer?.length) {
      throw new BadRequestException('Dosya gerekli');
    }
    const url = await this.imageService.upload(org.id, file);
    await this.productService.addImageUrl(org.id, id, url);
    return { url };
  }
}
