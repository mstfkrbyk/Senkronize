import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Marketplace } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export type ProductSortField =
  | 'name'
  | 'price'
  | 'stock'
  | 'createdAt'
  | 'updatedAt';

export type ProductSortOrder = 'asc' | 'desc';

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  isActive?: boolean;
  minPrice?: number;
  maxPrice?: number;
  minStock?: number;
  maxStock?: number;
  hasVariants?: boolean;
  platform?: Marketplace;
}

export class CreateProductDto {
  @ApiProperty({
    description: 'Ürün adı veya kısa tanım',
    example: 'Organik Çay 500g',
    required: true,
  })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    description: 'Barkod (EAN/UPC veya dahili kod)',
    example: '8680001122334',
    required: true,
  })
  @IsString()
  @MinLength(1)
  barcode!: string;

  @ApiPropertyOptional({
    description: 'Stok tutma birimi SKU kodu',
    example: 'SKU-ORG-CAY-500',
    required: false,
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({
    description: 'Marka adı',
    example: 'Doğa Çayları',
    required: false,
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Ürün kategorisi veya sınıflandırma yolu',
    example: 'İçecekler / Çay',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Hiyerarşik iç kategori kimliği (ProductCategory)',
    required: false,
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Ürün açıklaması (HTML veya düz metin)',
    example: 'Demlik poşet, 25 adet.',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Maliyet fiyatı (TL)',
    example: 42.5,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({
    description: 'Etiket listesi',
    example: ['organik', 'çay'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateProductDto {
  @ApiPropertyOptional({
    description: 'Güncellenecek ürün adı',
    example: 'Organik Çay 500g — Yeni ambalaj',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional({
    description: 'Güncellenecek barkod',
    example: '8680001122334',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  barcode?: string;

  @ApiPropertyOptional({
    description: 'SKU kodu',
    example: 'SKU-ORG-CAY-500-V2',
    required: false,
  })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({
    description: 'Marka adı',
    required: false,
  })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({
    description: 'Kategori',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Hiyerarşik iç kategori kimliği',
    required: false,
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Açıklama metni',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Ürünün panelde aktif görünüp görünmeyeceği',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Maliyet fiyatı (TL)',
    example: 45,
    minimum: 0,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number;

  @ApiPropertyOptional({
    description: 'Etiket listesi',
    example: ['çay', 'demlik'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Minimum stok eşiği (otomatik sipariş uyarısı)',
    example: 20,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderPoint?: number;

  @ApiPropertyOptional({
    description: 'Önerilen sipariş miktarı',
    example: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderQty?: number;

  @ApiPropertyOptional({
    description: 'Tedarik süresi (gün)',
    example: 7,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leadTimeDays?: number;
}

export class UpdateProductReorderDto {
  @ApiPropertyOptional({ example: 20, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderPoint?: number;

  @ApiPropertyOptional({ example: 100, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  reorderQty?: number;

  @ApiPropertyOptional({ example: 7, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  leadTimeDays?: number;
}

export class ProductQueryDto {
  @ApiPropertyOptional({
    description: 'Ad, barkod veya SKU üzerinden arama',
    example: 'çay',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Yalnızca aktif veya pasif ürünler',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Kategoriye göre filtre (metin)',
    example: 'İçecekler',
    required: false,
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    description: 'Hiyerarşik kategori kimliği',
    required: false,
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'Minimum satış fiyatı (varyant veya listing)',
    example: 10,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Maksimum satış fiyatı (varyant veya listing)',
    example: 500,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Minimum stok (varyant bazlı)',
    example: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minStock?: number;

  @ApiPropertyOptional({
    description: 'Maksimum stok (varyant bazlı)',
    example: 1000,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxStock?: number;

  @ApiPropertyOptional({
    description: 'Varyantı olan/olmayan ürünler',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  hasVariants?: boolean;

  @ApiPropertyOptional({
    description: 'Belirli pazaryerinde listelenmiş ürünler',
    enum: Marketplace,
    required: false,
  })
  @IsOptional()
  @IsEnum(Marketplace)
  platform?: Marketplace;

  @ApiPropertyOptional({
    description: 'Minimum maliyet fiyatı',
    example: 10,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  minCostPrice?: number;

  @ApiPropertyOptional({
    description: 'Maksimum maliyet fiyatı',
    example: 500,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  maxCostPrice?: number;

  @ApiPropertyOptional({
    description: 'Sıralama alanı',
    enum: ['name', 'price', 'stock', 'createdAt', 'updatedAt'],
    required: false,
  })
  @IsOptional()
  @IsIn(['name', 'price', 'stock', 'createdAt', 'updatedAt'])
  sortBy?: ProductSortField;

  @ApiPropertyOptional({
    description: 'Sıralama yönü',
    enum: ['asc', 'desc'],
    required: false,
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: ProductSortOrder;

  @ApiPropertyOptional({
    description: 'Sayfa numarası',
    example: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Sayfa başına kayıt (en fazla 100)',
    example: 20,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export type ProductStockPatchReason = 'COUNT' | 'IN' | 'OUT' | 'ADJUSTMENT';

export class UpdateProductStockDto {
  @ApiProperty({ description: 'Yeni stok miktarı', example: 42, minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;

  @ApiProperty({
    description: 'Stok güncelleme nedeni',
    enum: ['COUNT', 'IN', 'OUT', 'ADJUSTMENT'],
    example: 'COUNT',
  })
  @IsIn(['COUNT', 'IN', 'OUT', 'ADJUSTMENT'])
  reason!: ProductStockPatchReason;

  @ApiPropertyOptional({ description: 'Ek not', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SyncAllPlatformsDto {
  @ApiPropertyOptional({
    description: 'Senkronize edilecek listeleme kimlikleri',
    example: ['clxyz123', 'clxyz456'],
    type: [String],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  listingIds?: string[];

  @ApiProperty({
    description:
      'listingIds verilmediyse zorunlu: stok/fiyat güncellenecek ürün barkodu',
    example: '8680001122334',
    required: true,
  })
  @ValidateIf((o: SyncAllPlatformsDto) => !o.listingIds?.length)
  @IsString()
  @MinLength(1)
  barcode!: string;

  @ApiProperty({
    description: 'listingIds verilmediyse zorunlu: gönderilecek stok miktarı',
    example: 120,
    minimum: 0,
    required: true,
  })
  @ValidateIf((o: SyncAllPlatformsDto) => !o.listingIds?.length)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Pazaryerlerine gönderilecek satış fiyatı (TL)',
    example: 199.99,
    minimum: 0.01,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  price?: number;
}
