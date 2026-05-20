import { Module } from '@nestjs/common';

import { Dynamics365ErpAdapter } from './dynamics365-erp.adapter';
import { EpicorErpAdapter } from './epicor-erp.adapter';
import { ErpAdapterRegistry } from './erp-adapter.registry';
import { IqraErpAdapter } from './iqra-erp.adapter';
import { LightspeedErpAdapter } from './lightspeed-erp.adapter';
import { NetsuiteErpAdapter } from './netsuite-erp.adapter';
import { OdooErpAdapter } from './odoo-erp.adapter';
import { QuickbooksErpAdapter } from './quickbooks-erp.adapter';
import { Sage50ErpAdapter } from './sage50-erp.adapter';
import { VendPosErpAdapter } from './vend-pos-erp.adapter';
import { XeroErpAdapter } from './xero-erp.adapter';

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
];

@Module({
  providers: [...erpAdapters, ErpAdapterRegistry],
  exports: [...erpAdapters, ErpAdapterRegistry],
})
export class ErpAdaptersModule {}
