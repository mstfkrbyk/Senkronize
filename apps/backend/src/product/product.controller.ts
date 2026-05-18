import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import type { Product } from '@prisma/client';

import { CurrentOrg, CurrentOrgPayload } from '../auth/current-org.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ImageService } from '../image/image.service';

import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './product.dto';
import { ProductService } from './product.service';

const PRODUCT_IMAGE_LIMIT = 5 * 1024 * 1024;
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly imageService: ImageService,
  ) {}

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

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Ürün kataloğu listesi' })
  @ApiResponse({ status: 200, description: 'Sayfalı liste' })
  async findAll(
    @CurrentOrg() org: CurrentOrgPayload,
    @Query() query: ProductQueryDto,
  ): Promise<{ items: Product[]; total: number }> {
    return this.productService.findAll(org.id, query);
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
