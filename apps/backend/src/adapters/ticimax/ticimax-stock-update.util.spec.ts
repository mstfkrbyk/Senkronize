import { buildTicimaxStockUpdates } from './ticimax-stock-update.util';
import { parseTicimaxVariationId } from './ticimax-soap.util';

describe('ticimax stock update', () => {
  it('parses numeric variation ids', () => {
    expect(parseTicimaxVariationId('12345')).toBe(12345);
    expect(parseTicimaxVariationId('CT-7019')).toBeNull();
    expect(parseTicimaxVariationId('')).toBeNull();
  });

  it('builds stock updates from platform product ids', () => {
    const { parsed, skippedBarcodes } = buildTicimaxStockUpdates([
      { barcode: 'CT-7019', quantity: 5, platformProductId: '991' },
      { barcode: 'CT-7024', quantity: 3, platformProductId: '992' },
      { barcode: 'NO-ID', quantity: 1 },
    ]);
    expect(parsed).toEqual([
      { variationId: 991, quantity: 5 },
      { variationId: 992, quantity: 3 },
    ]);
    expect(skippedBarcodes).toEqual(['NO-ID']);
  });

  it('deduplicates by variation id keeping latest quantity', () => {
    const { parsed } = buildTicimaxStockUpdates([
      { barcode: 'A', quantity: 1, platformProductId: '10' },
      { barcode: 'B', quantity: 9, platformProductId: '10' },
    ]);
    expect(parsed).toEqual([{ variationId: 10, quantity: 9 }]);
  });
});
