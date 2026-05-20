import { BadRequestException } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import type { IMarketplaceAdapter } from '@senkronize/shared';

import { DolapAdapter } from './dolap/dolap.adapter';
import { PazaramaAdapter } from './pazarama/pazarama.adapter';
import { TemuAdapter } from './temu/temu.adapter';

/** Pazaryeri tipine göre adaptör örneği oluşturur (Nest DI dışı kullanım için) */
export function createMarketplaceAdapter(
  platform: Marketplace,
): IMarketplaceAdapter {
  switch (platform) {
    case Marketplace.PAZARAMA:
      return new PazaramaAdapter();
    case Marketplace.DOLAP:
      return new DolapAdapter();
    case Marketplace.TEMU:
      return new TemuAdapter();
    default:
      throw new BadRequestException(`Desteklenmeyen pazaryeri: ${platform}`);
  }
}
