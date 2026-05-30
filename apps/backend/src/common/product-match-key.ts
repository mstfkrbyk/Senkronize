import type { Prisma, ProductMatchKey as PrismaProductMatchKey } from '@prisma/client';

export type ProductMatchKey = 'BARCODE' | 'SKU' | 'MANUAL';

export interface MatchIdentifiers {
  barcode: string;
  sku?: string | null;
}

export interface ProductMatchKeyContext {
  productMatchKey?: ProductMatchKey | PrismaProductMatchKey | null;
  connectionMatchKey?: ProductMatchKey | PrismaProductMatchKey | null;
  orgMatchKey?: ProductMatchKey | null;
}

const VALID_MATCH_KEYS: readonly ProductMatchKey[] = ['BARCODE', 'SKU', 'MANUAL'];

export function isProductMatchKey(value: unknown): value is ProductMatchKey {
  return (
    value === 'BARCODE' || value === 'SKU' || value === 'MANUAL'
  );
}

export function parseOptionalProductMatchKey(value: unknown): ProductMatchKey | null {
  return isProductMatchKey(value) ? value : null;
}

/** @deprecated Geçersiz değerler için null kullanın — `parseOptionalProductMatchKey` */
export function normalizeProductMatchKey(value: unknown): ProductMatchKey {
  return parseOptionalProductMatchKey(value) ?? 'BARCODE';
}

export function resolveEffectiveProductMatchKey(
  ctx: ProductMatchKeyContext,
): ProductMatchKey | null {
  if (isProductMatchKey(ctx.productMatchKey)) {
    return ctx.productMatchKey;
  }
  if (isProductMatchKey(ctx.connectionMatchKey)) {
    return ctx.connectionMatchKey;
  }
  if (isProductMatchKey(ctx.orgMatchKey)) {
    return ctx.orgMatchKey;
  }
  return null;
}

export function buildProductWhereForMatchKey(
  organizationId: string,
  matchKey: ProductMatchKey,
  ids: MatchIdentifiers,
): Prisma.ProductWhereInput | null {
  const barcode = ids.barcode.trim();
  const sku = (ids.sku ?? '').trim();

  if (matchKey === 'BARCODE') {
    if (barcode.length === 0) {
      return null;
    }
    return { organizationId, barcode, deletedAt: null };
  }

  if (matchKey === 'SKU') {
    const skuValue = sku.length > 0 ? sku : barcode;
    if (skuValue.length === 0) {
      return null;
    }
    return { organizationId, sku: skuValue, deletedAt: null };
  }

  return null;
}

/** Listeleme → katalog eşlemesi (SKU modunda sku ve barkod alanlarını dener) */
export function buildProductWhereForListingMatch(
  organizationId: string,
  matchKey: ProductMatchKey,
  ids: MatchIdentifiers,
): Prisma.ProductWhereInput | null {
  if (matchKey === 'MANUAL') {
    return null;
  }

  if (matchKey === 'BARCODE') {
    return buildProductWhereForMatchKey(organizationId, 'BARCODE', ids);
  }

  const barcode = ids.barcode.trim();
  const sku = (ids.sku ?? '').trim();
  const primary = sku.length > 0 ? sku : barcode;
  if (primary.length === 0) {
    return null;
  }

  const keys = new Set<string>([primary]);
  if (barcode.length > 0 && barcode !== primary) {
    keys.add(barcode);
  }

  const or: Prisma.ProductWhereInput[] = [];
  for (const key of keys) {
    or.push({ sku: key }, { barcode: key });
  }

  return { organizationId, deletedAt: null, OR: or };
}

export function resolveListingMatchIdentifiers(
  listing: { barcode: string },
  platformSku?: string | null,
): MatchIdentifiers {
  const barcode = listing.barcode.trim();
  const sku = (platformSku ?? '').trim();
  return { barcode, sku: sku.length > 0 ? sku : barcode };
}

/** ERP / listing satırından katalogda arama için tanımlayıcılar */
export function resolveStockBarcode(
  productBarcode: string,
  productSku: string | null | undefined,
): string {
  const barcode = productBarcode.trim();
  if (barcode.length > 0) {
    return barcode;
  }
  return (productSku ?? '').trim();
}

export function resolveProductStockKey(product: {
  barcode?: string | null;
  sku?: string | null;
}): string | null {
  const barcode = (product.barcode ?? '').trim();
  if (barcode.length > 0) {
    return barcode;
  }
  const sku = (product.sku ?? '').trim();
  return sku.length > 0 ? sku : null;
}

export function collectProductStockKeys(
  items: Array<{ barcode?: string | null; sku?: string | null }>,
): string[] {
  const keys = new Set<string>();
  for (const item of items) {
    const key = resolveProductStockKey(item);
    if (key) {
      keys.add(key);
    }
  }
  return [...keys];
}

export function buildListingOrForProduct(
  productId: string,
  product: { barcode?: string | null; sku?: string | null },
): Array<{ productId: string } | { barcode: string }> {
  const or: Array<{ productId: string } | { barcode: string }> = [{ productId }];
  const barcode = (product.barcode ?? '').trim();
  if (barcode.length > 0) {
    or.push({ barcode });
  }
  const stockKey = resolveProductStockKey(product);
  if (stockKey) {
    or.push({ barcode: stockKey });
  }
  return or;
}

export { VALID_MATCH_KEYS };
