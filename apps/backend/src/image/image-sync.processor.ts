import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import type { Job } from 'bull';

import { CacheService } from '../common/cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUE_IMAGE_SYNC } from '../queue/queue.constants';
import type { ImageSyncJobData } from '../queue/queue.types';

import { ImageService } from './image.service';

@Processor(QUEUE_IMAGE_SYNC)
export class ImageSyncProcessor {
  private readonly logger = new Logger(ImageSyncProcessor.name);

  constructor(
    private readonly imageService: ImageService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Process('sync-image')
  async processImageSync(job: Job<ImageSyncJobData>): Promise<void> {
    const { productId, imageUrl, organizationId } = job.data;

    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      this.logger.warn('Geçersiz görsel URL', { organizationId, productId });
      return;
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      this.logger.warn('Görsel URL yalnızca http(s) olmalı', {
        organizationId,
        productId,
      });
      return;
    }

    let buffer: Buffer;
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: 15_000,
        maxContentLength: 15 * 1024 * 1024,
        maxBodyLength: 15 * 1024 * 1024,
      });
      buffer = Buffer.from(response.data as ArrayBuffer);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Görsel indirilemedi: ${message}`, {
        organizationId,
        productId,
      });
      throw error;
    }
    const ext =
      imageUrl.split('.').pop()?.split('?')[0]?.replace(/[^a-z0-9]/gi, '') ??
      'jpg';
    const filename = `products/${productId}-${Date.now()}.${ext}`;

    const r2Url = await this.imageService.uploadBuffer(
      buffer,
      filename,
      organizationId,
    );

    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId, deletedAt: null },
    });
    if (!product) {
      this.logger.warn('Ürün bulunamadı veya silinmiş', {
        organizationId,
        productId,
      });
      return;
    }

    await this.prisma.product.update({
      where: { id: productId },
      data: { imageUrls: { push: r2Url } },
    });
    await this.cache.invalidateProductsForOrg(organizationId);
  }
}
