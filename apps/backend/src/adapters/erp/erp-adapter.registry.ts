import { Injectable } from '@nestjs/common';
import type { IErpAdapter } from '@senkronize/shared';

import { AliciErpAdapter } from './alici-erp.adapter';
import { Dynamics365ErpAdapter } from './dynamics365-erp.adapter';
import { EpicorErpAdapter } from './epicor-erp.adapter';
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

/** ERP 3. + 4. tur adaptör kaydı */
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
    zirveBulut: ZirveBulutErpAdapter,
    netsis: NetsisErpCloudAdapter,
    mikroErp: MikroErpCloudAdapter,
    isbir: IsbirErpAdapter,
    alici: AliciErpAdapter,
    hizliMuhasebe: HizliMuhasebeErpAdapter,
    ideasoftErp: IdeasoftErpAdapter,
    vetassoft: VetassoftErpAdapter,
    probil: ProbilErpAdapter,
    etrade: EtradeErpAdapter,
    zohoBooks: ZohoBooksErpAdapter,
    freshbooks: FreshbooksErpAdapter,
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
      ['ZIRVE_BULUT', zirveBulut],
      ['NETSIS', netsis],
      ['MIKRO_ERP', mikroErp],
      ['ISBIR_ERP', isbir],
      ['ALICI_ERP', alici],
      ['HIZLI_MUHASEBE', hizliMuhasebe],
      ['IDEASOFT_ERP', ideasoftErp],
      ['VETASSOFT', vetassoft],
      ['PROBIL', probil],
      ['ETRADE_ERP', etrade],
      ['ZOHO_BOOKS', zohoBooks],
      ['FRESHBOOKS', freshbooks],
    ]);
  }

  get(erpType: string): IErpAdapter | undefined {
    return this.adapters.get(erpType);
  }

  has(erpType: string): boolean {
    return this.adapters.has(erpType);
  }
}
