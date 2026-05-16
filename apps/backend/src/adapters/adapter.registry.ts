import { Injectable, NotFoundException } from '@nestjs/common';
import type { IMarketplaceAdapter } from '@senkronize/shared';

import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';

@Injectable()
export class AdapterRegistry {
  private readonly adapters: Map<string, IMarketplaceAdapter>;

  constructor(
    private readonly trendyol: TrendyolAdapter,
    private readonly hepsiburada: HepsiburadaAdapter,
  ) {
    this.adapters = new Map<string, IMarketplaceAdapter>([
      ['TRENDYOL', trendyol],
      ['HEPSIBURADA', hepsiburada],
    ]);
  }

  get(platform: string): IMarketplaceAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new NotFoundException(`${platform} adapter bulunamadı`);
    }
    return adapter;
  }
}
