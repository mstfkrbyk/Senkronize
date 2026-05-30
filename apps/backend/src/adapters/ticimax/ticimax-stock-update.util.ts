import type { Logger } from '@nestjs/common';
import type { StockUpdatePayload } from '@senkronize/shared';

import {
  parseTicimaxVariationId,
  type TicimaxSoapClient,
  type TicimaxStockUpdate,
} from './ticimax-soap.util';

export function buildTicimaxStockUpdates(
  updates: StockUpdatePayload[],
): { parsed: TicimaxStockUpdate[]; skippedBarcodes: string[] } {
  const parsed: TicimaxStockUpdate[] = [];
  const skippedBarcodes: string[] = [];
  const seenIds = new Set<number>();

  for (const update of updates) {
    const variationId = parseTicimaxVariationId(update.platformProductId);
    if (variationId === null) {
      skippedBarcodes.push(update.barcode);
      continue;
    }
    if (seenIds.has(variationId)) {
      const existing = parsed.find((row) => row.variationId === variationId);
      if (existing) {
        existing.quantity = update.quantity;
      }
      continue;
    }
    seenIds.add(variationId);
    parsed.push({
      variationId,
      quantity: update.quantity,
    });
  }

  return { parsed, skippedBarcodes };
}

export async function applyTicimaxStockUpdates(
  client: TicimaxSoapClient,
  updates: StockUpdatePayload[],
  logger?: Logger,
): Promise<void> {
  const { parsed, skippedBarcodes } = buildTicimaxStockUpdates(updates);

  if (skippedBarcodes.length > 0) {
    logger?.warn('Ticimax stok güncelleme: varyasyon ID eksik', {
      count: skippedBarcodes.length,
      sample: skippedBarcodes.slice(0, 5),
    });
  }

  if (parsed.length === 0) {
    throw new Error(
      'Ticimax stok güncellenemedi: listing platformProductId (varyasyon ID) bulunamadı. Önce Ticimax ilan sync çalıştırın.',
    );
  }

  await client.updateStockQuantities(parsed);
}
