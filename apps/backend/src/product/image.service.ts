import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Product } from '@prisma/client';

import { CacheService } from '../common/cache/cache.service';
import { ImageService as R2ImageService } from '../image/image.service';
import { PrismaService } from '../prisma/prisma.service';

export interface ProductImageRecord {
  id: string;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
}

@Injectable()
export class ProductImageService {
  private readonly logger = new Logger(ProductImageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly r2: R2ImageService,
    private readonly cache: CacheService,
  ) {}

  /** Watermark ekleme — henüz uygulanmadı (stub). */
  applyWatermark(buffer: Buffer): Buffer {
    void buffer;
    return buffer;
  }

  async listImages(
    organizationId: string,
    productId: string,
  ): Promise<ProductImageRecord[]> {
    const product = await this.assertProduct(organizationId, productId);
    return this.toImageRecords(product.imageUrls ?? []);
  }

  async uploadImage(
    organizationId: string,
    productId: string,
    file: Express.Multer.File,
    options?: { watermark?: boolean },
  ): Promise<ProductImageRecord> {
    await this.assertProduct(organizationId, productId);
    let buffer = file.buffer;
    if (options?.watermark) {
      buffer = this.applyWatermark(buffer);
    }
    const uploadFile: Express.Multer.File = { ...file, buffer };
    const url = await this.r2.upload(organizationId, uploadFile);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId, deletedAt: null },
      select: { imageUrls: true },
    });
    const urls = [...(product?.imageUrls ?? []), url];
    await this.prisma.product.update({
      where: { id: productId },
      data: { imageUrls: urls },
    });
    await this.cache.invalidateProductsForOrg(organizationId);
    const records = this.toImageRecords(urls);
    const created = records[records.length - 1];
    if (!created) {
      throw new BadRequestException('Görsel kaydedilemedi');
    }
    return created;
  }

  async deleteImage(
    organizationId: string,
    productId: string,
    imageId: string,
  ): Promise<ProductImageRecord[]> {
    const product = await this.assertProduct(organizationId, productId);
    const urls = [...(product.imageUrls ?? [])];
    const index = this.resolveImageIndex(urls, imageId);
    if (index < 0) {
      throw new NotFoundException('Görsel bulunamadı');
    }
    const [removed] = urls.splice(index, 1);
    if (removed) {
      await this.tryDeleteFromR2(removed);
    }
    await this.prisma.product.update({
      where: { id: productId },
      data: { imageUrls: urls },
    });
    await this.cache.invalidateProductsForOrg(organizationId);
    return this.toImageRecords(urls);
  }

  async reorderImages(
    organizationId: string,
    productId: string,
    imageIds: string[],
  ): Promise<ProductImageRecord[]> {
    const product = await this.assertProduct(organizationId, productId);
    const urls = product.imageUrls ?? [];
    const reordered = this.reorderByIds(urls, imageIds);
    await this.prisma.product.update({
      where: { id: productId },
      data: { imageUrls: reordered },
    });
    await this.cache.invalidateProductsForOrg(organizationId);
    return this.toImageRecords(reordered);
  }

  async setPrimaryImage(
    organizationId: string,
    productId: string,
    imageId: string,
  ): Promise<ProductImageRecord[]> {
    const product = await this.assertProduct(organizationId, productId);
    const urls = [...(product.imageUrls ?? [])];
    const index = this.resolveImageIndex(urls, imageId);
    if (index < 0) {
      throw new NotFoundException('Görsel bulunamadı');
    }
    const [primary] = urls.splice(index, 1);
    if (!primary) {
      throw new NotFoundException('Görsel bulunamadı');
    }
    urls.unshift(primary);
    await this.prisma.product.update({
      where: { id: productId },
      data: { imageUrls: urls },
    });
    await this.cache.invalidateProductsForOrg(organizationId);
    return this.toImageRecords(urls);
  }

  private async assertProduct(
    organizationId: string,
    productId: string,
  ): Promise<Product> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId, deletedAt: null },
    });
    if (!product) {
      throw new NotFoundException('Ürün bulunamadı');
    }
    return product;
  }

  private toImageRecords(urls: string[]): ProductImageRecord[] {
    return urls.map((url, index) => ({
      id: String(index),
      url,
      isPrimary: index === 0,
      sortOrder: index,
    }));
  }

  private resolveImageIndex(urls: string[], imageId: string): number {
    const asIndex = Number.parseInt(imageId, 10);
    if (
      Number.isFinite(asIndex) &&
      asIndex >= 0 &&
      asIndex < urls.length &&
      String(asIndex) === imageId
    ) {
      return asIndex;
    }
    return urls.findIndex((url) => url === imageId);
  }

  private reorderByIds(urls: string[], imageIds: string[]): string[] {
    const urlSet = new Set(urls);
    const reordered: string[] = [];
    for (const id of imageIds) {
      const index = this.resolveImageIndex(urls, id);
      if (index >= 0) {
        const url = urls[index];
        if (url && !reordered.includes(url)) {
          reordered.push(url);
        }
      } else if (urlSet.has(id) && !reordered.includes(id)) {
        reordered.push(id);
      }
    }
    for (const url of urls) {
      if (!reordered.includes(url)) {
        reordered.push(url);
      }
    }
    if (reordered.length !== urls.length) {
      throw new BadRequestException('Geçersiz görsel sıralaması');
    }
    return reordered;
  }

  private extractR2Key(url: string): string | null {
    const base = this.r2.getPublicBaseUrl();
    if (base && url.startsWith(`${base}/`)) {
      return url.slice(base.length + 1);
    }
    try {
      const parsed = new URL(url);
      return parsed.pathname.replace(/^\/+/, '');
    } catch {
      return null;
    }
  }

  private async tryDeleteFromR2(url: string): Promise<void> {
    if (!this.r2.isR2Enabled()) {
      return;
    }
    const key = this.extractR2Key(url);
    if (!key) {
      return;
    }
    try {
      await this.r2.delete(key);
    } catch (error) {
      this.logger.warn('R2 görsel silinemedi', {
        key,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}
