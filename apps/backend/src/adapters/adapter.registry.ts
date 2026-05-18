import { Injectable, NotFoundException } from '@nestjs/common';
import type { IErpAdapter, IMarketplaceAdapter } from '@senkronize/shared';

import { BizimHesapAdapter } from './bizimhesap/bizimhesap.adapter';
import { HepsiburadaAdapter } from './hepsiburada/hepsiburada.adapter';
import { LucaAdapter } from './luca/luca.adapter';
import { LogoAdapter } from './logo/logo.adapter';
import { MikroAdapter } from './mikro/mikro.adapter';
import { ParasutAdapter } from './parasut/parasut.adapter';
import { TicimaxAdapter } from './ticimax/ticimax.adapter';
import { TrendyolAdapter } from './trendyol/trendyol.adapter';
import { TsoftAdapter } from './tsoft/tsoft.adapter';

@Injectable()
export class AdapterRegistry {
  private readonly adapters: Map<string, IMarketplaceAdapter>;
  private readonly erpAdapters: Map<string, IErpAdapter>;

  constructor(
    private readonly trendyol: TrendyolAdapter,
    private readonly hepsiburada: HepsiburadaAdapter,
    private readonly bizimhesap: BizimHesapAdapter,
    private readonly parasut: ParasutAdapter,
    private readonly logo: LogoAdapter,
    private readonly mikro: MikroAdapter,
    private readonly luca: LucaAdapter,
    private readonly tsoft: TsoftAdapter,
    private readonly ticimax: TicimaxAdapter,
  ) {
    this.adapters = new Map<string, IMarketplaceAdapter>([
      ['TRENDYOL', trendyol],
      ['HEPSIBURADA', hepsiburada],
      ['TSOFT', tsoft],
      ['TICIMAX', ticimax],
    ]);
    this.erpAdapters = new Map<string, IErpAdapter>([
      ['BIZIMHESAP', bizimhesap],
      ['PARASUT', parasut],
      ['LOGO', logo],
      ['MIKRO', mikro],
      ['LUCA', luca],
      ['TSOFT', tsoft],
      ['TICIMAX', ticimax],
    ]);
  }

  get(platform: string): IMarketplaceAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new NotFoundException(`${platform} adapter bulunamadı`);
    }
    return adapter;
  }

  getErp(erpType: string): IErpAdapter {
    const adapter = this.erpAdapters.get(erpType);
    if (!adapter) {
      throw new NotFoundException(`${erpType} ERP adapter bulunamadı`);
    }
    return adapter;
  }

  hasErpAdapter(erpType: string): boolean {
    return this.erpAdapters.has(erpType);
  }
}
