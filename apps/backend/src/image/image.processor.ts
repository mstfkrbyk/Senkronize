import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';

import { ListingService } from '../listing/listing.service';
import { ProductService } from '../product/product.service';
import { QUEUE_IMAGE } from '../queue/queue.constants';
import type { ImageUploadFromUrlJobData } from '../queue/queue.types';

import { ImageService } from './image.service';

@Processor(QUEUE_IMAGE)
export class ImageProcessor {
  private readonly logger = new Logger(ImageProcessor.name);

  constructor(
    private readonly imageService: ImageService,
    private readonly listingService: ListingService,
    private readonly productService: ProductService,
  ) {}

  @Process('upload-from-url')
  async handleUploadFromUrl(
    job: Job<ImageUploadFromUrlJobData>,
  ): Promise<void> {
    const { organizationId, imageUrl, resourceType, resourceId } = job.data;
    const r2Url = await this.imageService.uploadFromUrl(
      organizationId,
      imageUrl,
    );
    if (!r2Url) {
      this.logger.warn('R2 kapalı veya yükleme atlandı', {
        organizationId,
        resourceType,
        resourceId,
      });
      return;
    }

    if (resourceType === 'listing') {
      await this.listingService.addImageUrl(organizationId, resourceId, r2Url);
    } else {
      await this.productService.addImageUrl(organizationId, resourceId, r2Url);
    }
  }
}
