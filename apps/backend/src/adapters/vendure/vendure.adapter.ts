import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  GraphqlStubMarketplaceAdapter,
  type GraphqlStubMarketplaceOptions,
} from '../internal/graphql-stub-marketplace.adapter';

const VENDURE_DEFAULT_GRAPHQL = 'http://localhost:3000/admin-api';

@Injectable()
export class VendureAdapter extends GraphqlStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: GraphqlStubMarketplaceOptions = {
      platform: 'VENDURE',
      loggerContext: VendureAdapter.name,
      rateLimitKey: 'VENDURE',
      resolveGraphqlUrl: (creds) =>
        creds.graphqlUrl?.trim() ||
        creds.baseUrl?.trim() ||
        VENDURE_DEFAULT_GRAPHQL,
      resolveAuth: async (creds) => {
        const token = creds.accessToken?.trim() ?? creds.apiKey?.trim();
        if (!token) {
          throw new Error('Vendure: accessToken veya apiKey zorunludur');
        }
        return {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        };
      },
      testQuery: 'query { activeAdministrator { id } }',
    };
    super(encryptionService, opts);
  }
}
