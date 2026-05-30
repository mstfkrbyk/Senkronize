import type { IMarketplaceAdapter, MarketplaceListing } from '@senkronize/shared';

/** Platformdan tam liste çekilemedi — reconcile yapılmamalı */
export class ListingPullFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ListingPullFailedError';
  }
}

export interface ListingPullSnapshot {
  listings: MarketplaceListing[];
}

const MAX_LISTING_PAGES = 500;

/**
 * Adaptörden tüm sayfaları çeker.
 * Ara sayfa hatası veya tutarsız yanıt olursa hata fırlatır (mevcut DB kayıtları korunur).
 */
export async function fetchAllPlatformListings(
  adapter: IMarketplaceAdapter,
  credentials: Record<string, string>,
): Promise<ListingPullSnapshot> {
  const all: MarketplaceListing[] = [];
  let page = 0;

  while (page < MAX_LISTING_PAGES) {
    let batch;
    try {
      batch = await adapter.getListings(credentials, page);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Platform ilan listesi alınamadı';
      throw new ListingPullFailedError(message);
    }

    if (batch.items.length === 0) {
      if (page === 0) {
        break;
      }
      break;
    }

    all.push(...batch.items);

    const pageSize = batch.pageSize > 0 ? batch.pageSize : batch.items.length;
    if (batch.items.length < pageSize) {
      break;
    }

    page += 1;
  }

  if (page >= MAX_LISTING_PAGES) {
    throw new ListingPullFailedError(
      'Platform ilan listesi sayfa limitine ulaştı; tam snapshot alınamadı',
    );
  }

  return { listings: all };
}
