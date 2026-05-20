import { Injectable } from '@nestjs/common';
import type { IErpAdapter } from '@senkronize/shared';

import { AkinonErpAdapter } from './akinon-erp.adapter';
import { AliciErpAdapter } from './alici-erp.adapter';
import { AfasOnlineErpAdapter } from './afas-online/afas-online.adapter';
import { BimeksErpAdapter } from './bimeks-erp.adapter';
import { BillomatErpAdapter } from './billomat/billomat.adapter';
import { Cin7ErpAdapter } from './cin7/cin7.adapter';
import { DebitoorErpAdapter } from './debitoor/debitoor.adapter';
import { EdusonErpAdapter } from './eduson-erp.adapter';
import { EtaxErpAdapter } from './etax-erp.adapter';
import { FinnetErpAdapter } from './finnet-erp.adapter';
import { Dynamics365ErpAdapter } from './dynamics365-erp.adapter';
import { EpicorErpAdapter } from './epicor-erp.adapter';
import { EtradeErpAdapter } from './etrade-erp.adapter';
import { ExactOnlineErpAdapter } from './exact-online/exact-online.adapter';
import { FreshbooksErpAdapter } from './freshbooks-erp.adapter';
import { HizliMuhasebeErpAdapter } from './hizli-muhasebe-erp.adapter';
import { HoldedErpAdapter } from './holded/holded.adapter';
import { IdeasoftErpAdapter } from './ideasoft-erp.adapter';
import { InflowErpAdapter } from './inflow/inflow.adapter';
import { IqraErpAdapter } from './iqra-erp.adapter';
import { KatanaMrpErpAdapter } from './katana-mrp-erp.adapter';
import { IsbirErpAdapter } from './isbir-erp.adapter';
import { LightspeedErpAdapter } from './lightspeed-erp.adapter';
import { MikroErpCloudAdapter } from './mikro-erp.adapter';
import { MoneybirdErpAdapter } from './moneybird/moneybird.adapter';
import { MrpeasyErpAdapter } from './mrpeasy-erp.adapter';
import { NetsisErpCloudAdapter } from './netsis-erp.adapter';
import { PoseidonPosErpAdapter } from './poseidon-pos-erp.adapter';
import { RestmanErpAdapter } from './restman-erp.adapter';
import { NetsuiteErpAdapter } from './netsuite-erp.adapter';
import { OdooErpAdapter } from './odoo-erp.adapter';
import { ProbilErpAdapter } from './probil-erp.adapter';
import { QuickbooksErpAdapter } from './quickbooks-erp.adapter';
import { Sage50ErpAdapter } from './sage50-erp.adapter';
import { SevdeskErpAdapter } from './sevdesk/sevdesk.adapter';
import { SimpraPlusErpAdapter } from './simpra-plus-erp.adapter';
import { SmartiksErpAdapter } from './smartiks-erp.adapter';
import { TwinfieldErpAdapter } from './twinfield/twinfield.adapter';
import { UyumsoftErpAdapter } from './uyumsoft-erp.adapter';
import { VendPosErpAdapter } from './vend-pos-erp.adapter';
import { VetassoftErpAdapter } from './vetassoft-erp.adapter';
import { WaveAccountingErpAdapter } from './wave-accounting/wave-accounting.adapter';
import { XeroErpAdapter } from './xero-erp.adapter';
import { ZirveBulutErpAdapter } from './zirve-bulut-erp.adapter';
import { ZohoBooksErpAdapter } from './zoho-books-erp.adapter';
import { ZohoInventoryErpAdapter } from './zoho-inventory/zoho-inventory.adapter';

/** ERP 3. + 4. + 5. + 6. tur adaptör kaydı */
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
    holded: HoldedErpAdapter,
    debitoor: DebitoorErpAdapter,
    billomat: BillomatErpAdapter,
    sevdesk: SevdeskErpAdapter,
    exactOnline: ExactOnlineErpAdapter,
    twinfield: TwinfieldErpAdapter,
    afasOnline: AfasOnlineErpAdapter,
    moneybird: MoneybirdErpAdapter,
    waveAccounting: WaveAccountingErpAdapter,
    zohoInventory: ZohoInventoryErpAdapter,
    inflow: InflowErpAdapter,
    cin7: Cin7ErpAdapter,
    finnet: FinnetErpAdapter,
    etax: EtaxErpAdapter,
    uyumsoft: UyumsoftErpAdapter,
    eduson: EdusonErpAdapter,
    smartiks: SmartiksErpAdapter,
    poseidonPos: PoseidonPosErpAdapter,
    restman: RestmanErpAdapter,
    simpraPlus: SimpraPlusErpAdapter,
    akinonErp: AkinonErpAdapter,
    bimeksErp: BimeksErpAdapter,
    mrpeasy: MrpeasyErpAdapter,
    katanaMrp: KatanaMrpErpAdapter,
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
      ['HOLDED', holded],
      ['DEBITOOR', debitoor],
      ['BILLOMAT', billomat],
      ['SEVDESK', sevdesk],
      ['EXACT_ONLINE', exactOnline],
      ['TWINFIELD', twinfield],
      ['AFAS_ONLINE', afasOnline],
      ['MONEYBIRD', moneybird],
      ['WAVE_ACCOUNTING', waveAccounting],
      ['ZOHO_INVENTORY', zohoInventory],
      ['INFLOW', inflow],
      ['CIN7', cin7],
      ['FINNET', finnet],
      ['ETAX', etax],
      ['UYUMSOFT', uyumsoft],
      ['EDUSON', eduson],
      ['SMARTIKS', smartiks],
      ['POSEIDON_POS', poseidonPos],
      ['RESTMAN', restman],
      ['SIMPRA_PLUS', simpraPlus],
      ['AKINON_ERP', akinonErp],
      ['BIMEKS_ERP', bimeksErp],
      ['MRPEASY', mrpeasy],
      ['KATANA_MRP', katanaMrp],
    ]);
  }

  get(erpType: string): IErpAdapter | undefined {
    return this.adapters.get(erpType);
  }

  has(erpType: string): boolean {
    return this.adapters.has(erpType);
  }
}
