import { BadRequestException } from '@nestjs/common';
import { CargoProvider } from '@prisma/client';

import type { ICargoAdapter } from '../cargo-adapter.interface';
import { ArasCargoAdapter } from './aras.cargo-adapter';
import { DhlCargoAdapter } from './dhl.cargo-adapter';
import { MngCargoAdapter } from './mng.cargo-adapter';
import { PttKargoCargoAdapter } from './ptt-kargo.cargo-adapter';
import { SendeoCargoAdapter } from './sendeo.cargo-adapter';
import { SuratCargoAdapter } from './surat.cargo-adapter';
import { UpsCargoAdapter } from './ups.cargo-adapter';
import { YurticiCargoAdapter } from './yurtici.cargo-adapter';

export function createCargoAdapter(
  provider: CargoProvider,
  credentials: Record<string, unknown>,
): ICargoAdapter {
  switch (provider) {
    case CargoProvider.YURTICI:
      return new YurticiCargoAdapter(credentials);
    case CargoProvider.ARAS:
      return new ArasCargoAdapter(credentials);
    case CargoProvider.SURAT:
      return new SuratCargoAdapter(credentials);
    case CargoProvider.MNG:
      return new MngCargoAdapter(credentials);
    case CargoProvider.UPS:
      return new UpsCargoAdapter(credentials);
    case CargoProvider.DHL:
      return new DhlCargoAdapter(credentials);
    case CargoProvider.SENDEO:
      return new SendeoCargoAdapter(credentials);
    case CargoProvider.PTT:
    case CargoProvider.PTT_KARGO:
      return new PttKargoCargoAdapter(credentials);
    case CargoProvider.HEPSIJET:
    case CargoProvider.TRENDYOL_EXPRESS:
      throw new BadRequestException('Bu kargo sağlayıcısı için henüz adaptör tanımlı değil');
    default:
      throw new BadRequestException(
        `Desteklenmeyen kargo sağlayıcısı: ${String(provider)}`,
      );
  }
}
