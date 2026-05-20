import { BadRequestException } from '@nestjs/common';
import { CargoProvider } from '@prisma/client';

import type { ICargoAdapter } from '../cargo-adapter.interface';
import { ArasCargoAdapter } from './aras.cargo-adapter';
import { BringoCargoAdapter } from './bringo.cargo-adapter';
import { BrtCargoAdapter } from './brt.cargo-adapter';
import { CevaCargoAdapter } from './ceva.cargo-adapter';
import { ChronopostCargoAdapter } from './chronopost.cargo-adapter';
import { CorreosExpressCargoAdapter } from './correos-express.cargo-adapter';
import { DhlCargoAdapter } from './dhl.cargo-adapter';
import { DhlParcelCargoAdapter } from './dhl-parcel.cargo-adapter';
import { DpdCargoAdapter } from './dpd.cargo-adapter';
import { FedexCargoAdapter } from './fedex.cargo-adapter';
import { GlsCargoAdapter } from './gls.cargo-adapter';
import { HermesCargoAdapter } from './hermes.cargo-adapter';
import { DpdDeCargoAdapter } from './dpd-de.cargo-adapter';
import { EkolCargoAdapter } from './ekol.cargo-adapter';
import { FlashExpressCargoAdapter } from './flash-express.cargo-adapter';
import { GelalCargoAdapter } from './gelal.cargo-adapter';
import { HermesDeCargoAdapter } from './hermes-de.cargo-adapter';
import { JtExpressCargoAdapter } from './jt-express.cargo-adapter';
import { KerryExpressCargoAdapter } from './kerry-express.cargo-adapter';
import { KolayGelsinCargoAdapter } from './kolay-gelsin.cargo-adapter';
import { KollayCargoAdapter } from './kollay.cargo-adapter';
import { MngCargoAdapter } from './mng.cargo-adapter';
import { NartKargoCargoAdapter } from './nart-kargo.cargo-adapter';
import { NinjaVanCargoAdapter } from './ninja-van.cargo-adapter';
import { PackuppCargoAdapter } from './packupp.cargo-adapter';
import { PostNlCargoAdapter } from './postnl.cargo-adapter';
import { PttKargoCargoAdapter } from './ptt/ptt.adapter';
import { HorozCargoAdapter } from './horoz.cargo-adapter';
import { NetlogCargoAdapter } from './netlog.cargo-adapter';
import { SendeoCargoAdapter } from './sendeo.cargo-adapter';
import { SuratCargoAdapter } from './surat/surat.adapter';
import { TntCargoAdapter } from './tnt.cargo-adapter';
import { UpsCargoAdapter } from './ups/ups.adapter';
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
    case CargoProvider.DHL_PARCEL:
      return new DhlParcelCargoAdapter(credentials);
    case CargoProvider.FEDEX:
      return new FedexCargoAdapter(credentials);
    case CargoProvider.SENDEO:
      return new SendeoCargoAdapter(credentials);
    case CargoProvider.NETLOG:
      return new NetlogCargoAdapter(credentials);
    case CargoProvider.HOROZ:
      return new HorozCargoAdapter(credentials);
    case CargoProvider.TNT:
      return new TntCargoAdapter(credentials);
    case CargoProvider.GLS:
      return new GlsCargoAdapter(credentials);
    case CargoProvider.DPD:
      return new DpdCargoAdapter(credentials);
    case CargoProvider.HERMES:
      return new HermesCargoAdapter(credentials);
    case CargoProvider.POSTNL:
      return new PostNlCargoAdapter(credentials);
    case CargoProvider.BRINGO:
      return new BringoCargoAdapter(credentials);
    case CargoProvider.CEVA:
      return new CevaCargoAdapter(credentials);
    case CargoProvider.NART_KARGO:
      return new NartKargoCargoAdapter(credentials);
    case CargoProvider.KOLAY_GELSIN:
      return new KolayGelsinCargoAdapter(credentials);
    case CargoProvider.PACKUPP:
      return new PackuppCargoAdapter(credentials);
    case CargoProvider.GELAL:
      return new GelalCargoAdapter(credentials);
    case CargoProvider.EKOL:
      return new EkolCargoAdapter(credentials);
    case CargoProvider.KOLLAY:
      return new KollayCargoAdapter(credentials);
    case CargoProvider.HERMES_DE:
      return new HermesDeCargoAdapter(credentials);
    case CargoProvider.DPD_DE:
      return new DpdDeCargoAdapter(credentials);
    case CargoProvider.CHRONOPOST:
      return new ChronopostCargoAdapter(credentials);
    case CargoProvider.CORREOS_EXPRESS:
      return new CorreosExpressCargoAdapter(credentials);
    case CargoProvider.BRT:
      return new BrtCargoAdapter(credentials);
    case CargoProvider.JT_EXPRESS:
      return new JtExpressCargoAdapter(credentials);
    case CargoProvider.NINJA_VAN:
      return new NinjaVanCargoAdapter(credentials);
    case CargoProvider.KERRY_EXPRESS:
      return new KerryExpressCargoAdapter(credentials);
    case CargoProvider.FLASH_EXPRESS:
      return new FlashExpressCargoAdapter(credentials);
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
