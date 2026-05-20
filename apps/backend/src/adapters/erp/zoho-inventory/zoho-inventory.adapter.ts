import { Injectable } from '@nestjs/common';

import { OAuth2ErpAdapterBase, type OAuth2ErpAdapterConfig } from '../erp-oauth2-base.adapter';

@Injectable()
export class ZohoInventoryErpAdapter extends OAuth2ErpAdapterBase {
  readonly config: OAuth2ErpAdapterConfig = {
    erpType: 'ZOHO_INVENTORY',
    label: 'Zoho Inventory',
    defaultBaseUrl: 'https://www.zohoapis.com/inventory/v1',
    authHeaderPrefix: 'Zoho-oauthtoken',
    extraParams: (credentials) => {
      const organizationId = credentials.organizationId?.trim();
      const params: Record<string, string> = {};
      if (organizationId) {
        params.organization_id = organizationId;
      }
      return params;
    },
  };
}
