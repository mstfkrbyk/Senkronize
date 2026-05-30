import type { IMarketplaceAdapter, MarketplaceListing } from '@senkronize/shared';

import {
  fetchAllPlatformListings,
  ListingPullFailedError,
} from './listing-pull.util';

function listing(id: string): MarketplaceListing {
  return {
    platformProductId: id,
    barcode: id,
    title: `Product ${id}`,
    quantity: 1,
    salePrice: 10,
    listPrice: 12,
    approved: true,
    images: [],
  };
}

function mockAdapter(
  pages: MarketplaceListing[][],
  opts?: { throwOnPage?: number },
): IMarketplaceAdapter {
  return {
    platform: 'TICIMAX',
    testConnection: async () => true,
    getOrders: async () => [],
    getListings: async (_credentials, page = 0) => {
      if (opts?.throwOnPage === page) {
        throw new Error('API hatası');
      }
      const items = pages[page] ?? [];
      return {
        items,
        total: items.length,
        page,
        pageSize: 100,
      };
    },
    updateStock: async () => undefined,
    updatePrice: async () => undefined,
  };
}

describe('fetchAllPlatformListings', () => {
  it('paginates until a short page', async () => {
    const adapter = mockAdapter([
      Array.from({ length: 100 }, (_, i) => listing(`a-${String(i)}`)),
      [listing('b-1')],
    ]);
    const snapshot = await fetchAllPlatformListings(adapter, {});
    expect(snapshot.listings).toHaveLength(101);
  });

  it('returns empty snapshot without throwing', async () => {
    const adapter = mockAdapter([[]]);
    const snapshot = await fetchAllPlatformListings(adapter, {});
    expect(snapshot.listings).toHaveLength(0);
  });

  it('throws on adapter error so reconcile must not run', async () => {
    const adapter = mockAdapter(
      [Array.from({ length: 100 }, (_, i) => listing(`a-${String(i)}`))],
      { throwOnPage: 1 },
    );
    await expect(fetchAllPlatformListings(adapter, {})).rejects.toBeInstanceOf(
      ListingPullFailedError,
    );
  });
});
