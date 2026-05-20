import { Injectable } from '@nestjs/common';

import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  GraphqlStubMarketplaceAdapter,
  type GraphqlStubMarketplaceOptions,
} from '../internal/graphql-stub-marketplace.adapter';

const ENEBA_GRAPHQL = 'https://api.eneba.com/graphql';

@Injectable()
export class EnebaAdapter extends GraphqlStubMarketplaceAdapter {
  constructor(encryptionService: EncryptionService) {
    const opts: GraphqlStubMarketplaceOptions = {
      platform: 'ENEBA',
      loggerContext: EnebaAdapter.name,
      rateLimitKey: 'ENEBA',
      resolveGraphqlUrl: (creds) =>
        creds.graphqlUrl?.trim() ?? creds.baseUrl?.trim() ?? ENEBA_GRAPHQL,
      resolveAuth: async (creds) => {
        const apiKey = creds.apiKey?.trim();
        if (!apiKey) {
          throw new Error('Eneba: apiKey zorunludur');
        }
        return {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        };
      },
      testQuery: 'query { __typename }',
    };
    super(encryptionService, opts);
  }
}
