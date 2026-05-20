import { Module } from '@nestjs/common';

import { AliciErpAdapter } from './alici-erp.adapter';
import { Dynamics365ErpAdapter } from './dynamics365-erp.adapter';
import { EpicorErpAdapter } from './epicor-erp.adapter';
import { ErpAdapterRegistry } from './erp-adapter.registry';
import { EtradeErpAdapter } from './etrade-erp.adapter';
import { FreshbooksErpAdapter } from './freshbooks-erp.adapter';
import { HizliMuhasebeErpAdapter } from './hizli-muhasebe-erp.adapter';
import { IdeasoftErpAdapter } from './ideasoft-erp.adapter';
import { IqraErpAdapter } from './iqra-erp.adapter';
import { IsbirErpAdapter } from './isbir-erp.adapter';
import { LightspeedErpAdapter } from './lightspeed-erp.adapter';
import { MikroErpCloudAdapter } from './mikro-erp.adapter';
import { NetsisErpCloudAdapter } from './netsis-erp.adapter';
import { NetsuiteErpAdapter } from './netsuite-erp.adapter';
import { OdooErpAdapter } from './odoo-erp.adapter';
import { ProbilErpAdapter } from './probil-erp.adapter';
import { QuickbooksErpAdapter } from './quickbooks-erp.adapter';
import { Sage50ErpAdapter } from './sage50-erp.adapter';
import { VendPosErpAdapter } from './vend-pos-erp.adapter';
import { VetassoftErpAdapter } from './vetassoft-erp.adapter';
import { XeroErpAdapter } from './xero-erp.adapter';
import { ZirveBulutErpAdapter } from './zirve-bulut-erp.adapter';
import { ZohoBooksErpAdapter } from './zoho-books-erp.adapter';

const erpAdapters = [
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
  NetsisErpCloudAdapter,
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
];

@Module({
  providers: [...erpAdapters, ErpAdapterRegistry],
  exports: [...erpAdapters, ErpAdapterRegistry],
})
export class ErpAdaptersModule {}
