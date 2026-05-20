import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  GraphqlStubMarketplaceAdapter,
  type GraphqlStubMarketplaceOptions,
} from '../internal/graphql-stub-marketplace.adapter';

const SALEOR_DEFAULT_GRAPHQL = 'http://localhost:8000/graphql/';

@Injectable()
export class SaleorAdapter extends GraphqlStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: GraphqlStubMarketplaceOptions = {
      platform: 'SALEOR',
      loggerContext: SaleorAdapter.name,
      rateLimitKey: 'SALEOR',
      resolveGraphqlUrl: (creds) =>
        creds.graphqlUrl?.trim() ||
        creds.baseUrl?.trim() ||
        SALEOR_DEFAULT_GRAPHQL,
      resolveAuth: async (creds) => {
        const token = creds.accessToken?.trim() ?? creds.apiKey?.trim();
        if (!token) {
          throw new Error('Saleor: accessToken veya apiKey zorunludur');
        }
        return {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        };
      },
      testQuery: 'query { shop { name } }',
    };
    super(encryptionService, opts);
  }
}
