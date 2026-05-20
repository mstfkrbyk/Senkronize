import { Injectable } from '@nestjs/common';
import type { IErpAdapter } from '@senkronize/shared';

import { Dynamics365ErpAdapter } from './dynamics365-erp.adapter';
import { EpicorErpAdapter } from './epicor-erp.adapter';
import { IqraErpAdapter } from './iqra-erp.adapter';
import { LightspeedErpAdapter } from './lightspeed-erp.adapter';
import { NetsuiteErpAdapter } from './netsuite-erp.adapter';
import { OdooErpAdapter } from './odoo-erp.adapter';
import { QuickbooksErpAdapter } from './quickbooks-erp.adapter';
import { Sage50ErpAdapter } from './sage50-erp.adapter';
import { VendPosErpAdapter } from './vend-pos-erp.adapter';
import { XeroErpAdapter } from './xero-erp.adapter';

/** ERP 3. tur adaptör kaydı */
@Injectable()
export class ErpAdapterRegistry {
  readonly adapters: ReadonlyMap<string, IErpAdapter>;

  constructor(
    netsuite: NetsuiteErpAdapter,
    dynamics365: Dynamics365ErpAdapter,
    odoo: OdooErpAdapter,
    epicor: EpicorErpAdapter,
    iqraErp: IqraErpAdapter,
    quickbooks: QuickbooksErpAdapter,
    xero: XeroErpAdapter,
    sage50: Sage50ErpAdapter,
    lightspeed: LightspeedErpAdapter,
    vendPos: VendPosErpAdapter,
  ) {
    this.adapters = new Map<string, IErpAdapter>([
      ['NETSUITE', netsuite],
      ['DYNAMICS365', dynamics365],
      ['ODOO', odoo],
      ['EPICOR', epicor],
      ['IQRA_ERP', iqraErp],
      ['QUICKBOOKS', quickbooks],
      ['XERO', xero],
      ['SAGE50', sage50],
      ['LIGHTSPEED', lightspeed],
      ['VEND_POS', vendPos],
    ]);
  }

  get(erpType: string): IErpAdapter | undefined {
    return this.adapters.get(erpType);
  }

  has(erpType: string): boolean {
    return this.adapters.has(erpType);
  }
}
