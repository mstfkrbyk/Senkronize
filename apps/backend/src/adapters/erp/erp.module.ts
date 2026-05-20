import { Module } from '@nestjs/common';

import { AkinonErpAdapter } from './akinon-erp.adapter';
import { AliciErpAdapter } from './alici-erp.adapter';
import { AfasOnlineModule } from './afas-online/afas-online.module';
import { BimeksErpAdapter } from './bimeks-erp.adapter';
import { BrightpearlErpAdapter } from './brightpearl-erp.adapter';
import { BillomatModule } from './billomat/billomat.module';
import { BizimHesapErpAdapter } from './bizimhesap-erp.adapter';
import { Cin7Module } from './cin7/cin7.module';
import { DebitoorModule } from './debitoor/debitoor.module';
import { Dynamics365ErpAdapter } from './dynamics365-erp.adapter';
import { DearSystemsErpAdapter } from './dear-systems-erp.adapter';
import { EdusonErpAdapter } from './eduson-erp.adapter';
import { EpicorErpAdapter } from './epicor-erp.adapter';
import { EtaxErpAdapter } from './etax-erp.adapter';
import { FinnetErpAdapter } from './finnet-erp.adapter';
import { FishbowlErpAdapter } from './fishbowl-erp.adapter';
import { ErpAdapterRegistry } from './erp-adapter.registry';
import { EtradeErpAdapter } from './etrade-erp.adapter';
import { ExactOnlineModule } from './exact-online/exact-online.module';
import { FreshbooksErpAdapter } from './freshbooks-erp.adapter';
import { HizliMuhasebeErpAdapter } from './hizli-muhasebe-erp.adapter';
import { HoldedModule } from './holded/holded.module';
import { IdeasoftErpAdapter } from './ideasoft-erp.adapter';
import { InflowModule } from './inflow/inflow.module';
import { IqraErpAdapter } from './iqra-erp.adapter';
import { KatanaMrpErpAdapter } from './katana-mrp-erp.adapter';
import { KolaymuhasebeErpAdapter } from './kolaymuhasebe-erp.adapter';
import { IsbirErpAdapter } from './isbir-erp.adapter';
import { LightspeedErpAdapter } from './lightspeed-erp.adapter';
import { LightspeedRestaurantErpAdapter } from './lightspeed-restaurant-erp.adapter';
import { LogoTigerModule } from './logo/logo.module';
import { LogoTigerErpAdapter } from './logo/logo.adapter';
import { MikroErpModule } from './mikro/mikro.module';
import { MikroErpAdapter } from './mikro/mikro.adapter';
import { MikroErpCloudAdapter } from './mikro-erp.adapter';
import { MoneybirdModule } from './moneybird/moneybird.module';
import { MedulaErpAdapter } from './medula-erp.adapter';
import { MrpeasyErpAdapter } from './mrpeasy-erp.adapter';
import { MuhasebeNetErpAdapter } from './muhasebe-net-erp.adapter';
import { NetsisErpAdapter } from './netsis/netsis.adapter';
import { NetsuiteErpAdapter } from './netsuite/netsuite.adapter';
import { OdooErpAdapter } from './odoo-erp.adapter';
import { OracleMicrosErpAdapter } from './oracle-micros-erp.adapter';
import { ParasutErpAdapter } from './parasut-erp.adapter';
import { ParasutPlusErpAdapter } from './parasut-plus-erp.adapter';
import { PoseidonPosErpAdapter } from './poseidon-pos-erp.adapter';
import { ProbilErpAdapter } from './probil-erp.adapter';
import { ProbilEczaneErpAdapter } from './probil-eczane-erp.adapter';
import { QuickbooksErpAdapter } from './quickbooks-erp.adapter';
import { RestmanErpAdapter } from './restman-erp.adapter';
import { Sage50ErpAdapter } from './sage50-erp.adapter';
import { SevdeskModule } from './sevdesk/sevdesk.module';
import { SimpraPlusErpAdapter } from './simpra-plus-erp.adapter';
import { TradegeckoErpAdapter } from './tradegecko-erp.adapter';
import { SmartiksErpAdapter } from './smartiks-erp.adapter';
import { TicimaxErpAdapter } from './ticimax-erp.adapter';
import { TsoftErpAdapter } from './tsoft-erp.adapter';
import { TwinfieldModule } from './twinfield/twinfield.module';
import { UnleashedErpAdapter } from './unleashed-erp.adapter';
import { UyumsoftErpAdapter } from './uyumsoft-erp.adapter';
import { VendPosErpAdapter } from './vend-pos-erp.adapter';
import { VetassoftErpAdapter } from './vetassoft-erp.adapter';
import { WaveAccountingModule } from './wave-accounting/wave-accounting.module';
import { XeroErpAdapter } from './xero-erp.adapter';
import { ZirveBulutErpAdapter } from './zirve-bulut-erp.adapter';
import { ZohoBooksErpAdapter } from './zoho-books-erp.adapter';
import { ZohoInventoryModule } from './zoho-inventory/zoho-inventory.module';

const erpRound5Modules = [
  LogoTigerModule,
  MikroErpModule,
  HoldedModule,
  DebitoorModule,
  BillomatModule,
  SevdeskModule,
  ExactOnlineModule,
  TwinfieldModule,
  AfasOnlineModule,
  MoneybirdModule,
  WaveAccountingModule,
  ZohoInventoryModule,
  InflowModule,
  Cin7Module,
] as const;

const legacyErpAdapters = [
  BizimHesapErpAdapter,
  ParasutErpAdapter,
  LogoTigerErpAdapter,
  TsoftErpAdapter,
  TicimaxErpAdapter,
  NetsuiteErpAdapter,
  Dynamics365ErpAdapter,
  OdooErpAdapter,
  EpicorErpAdapter,
  IqraErpAdapter,
  QuickbooksErpAdapter,
  XeroErpAdapter,
  Sage50ErpAdapter,
  LightspeedErpAdapter,
  VendPosErpAdapter,
  ZirveBulutErpAdapter,
  NetsisErpAdapter,
  MikroErpAdapter,
  MikroErpCloudAdapter,
  IsbirErpAdapter,
  AliciErpAdapter,
  HizliMuhasebeErpAdapter,
  IdeasoftErpAdapter,
  VetassoftErpAdapter,
  ProbilErpAdapter,
  EtradeErpAdapter,
  ZohoBooksErpAdapter,
  FreshbooksErpAdapter,
  FinnetErpAdapter,
  EtaxErpAdapter,
  UyumsoftErpAdapter,
  EdusonErpAdapter,
  SmartiksErpAdapter,
  PoseidonPosErpAdapter,
  RestmanErpAdapter,
  SimpraPlusErpAdapter,
  AkinonErpAdapter,
  BimeksErpAdapter,
  MrpeasyErpAdapter,
  KatanaMrpErpAdapter,
  ParasutPlusErpAdapter,
  MuhasebeNetErpAdapter,
  KolaymuhasebeErpAdapter,
  FishbowlErpAdapter,
  DearSystemsErpAdapter,
  BrightpearlErpAdapter,
  UnleashedErpAdapter,
  TradegeckoErpAdapter,
  ProbilEczaneErpAdapter,
  MedulaErpAdapter,
  LightspeedRestaurantErpAdapter,
  OracleMicrosErpAdapter,
];

@Module({
  imports: [...erpRound5Modules],
  providers: [...legacyErpAdapters, ErpAdapterRegistry],
  exports: [...legacyErpAdapters, ErpAdapterRegistry, ...erpRound5Modules],
})
export class ErpAdaptersModule {}
