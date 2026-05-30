export type ProductMatchKey = 'BARCODE' | 'SKU' | 'MANUAL';

export const PRODUCT_MATCH_KEY_OPTIONS: ProductMatchKey[] = ['BARCODE', 'SKU', 'MANUAL'];

export const PRODUCT_MATCH_KEY_INHERIT = '__inherit__' as const;

export type ProductMatchKeySelectValue = ProductMatchKey | typeof PRODUCT_MATCH_KEY_INHERIT;

export interface OrganizationSettingsMatchKey {
  productMatchKey: ProductMatchKey | null;
}

const PRODUCT_MATCH_KEY_SET = new Set<string>(PRODUCT_MATCH_KEY_OPTIONS);

export function normalizeProductMatchKeySelectValue(
  value: ProductMatchKey | null | undefined,
): ProductMatchKeySelectValue {
  if (value == null || !PRODUCT_MATCH_KEY_SET.has(value)) {
    return PRODUCT_MATCH_KEY_INHERIT;
  }
  return value;
}

export function effectiveMatchKeyLabel(
  key: ProductMatchKey | null,
  t: (key: string) => string,
): string {
  if (key === null) {
    return t('productMatching.matchKey.notConfigured');
  }
  return t(`productMatching.matchKey.options.${key}`);
}
