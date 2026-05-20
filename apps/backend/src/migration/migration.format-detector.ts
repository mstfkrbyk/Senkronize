import type { MigrationSourceFormat } from './migration.types';

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, '').replace(/^\uFEFF/, '');
}

export function detectSourceFormat(
  headers: string[],
  fileName: string,
  mimeType: string,
  explicit?: string,
): MigrationSourceFormat {
  if (explicit) {
    const known = explicit as MigrationSourceFormat;
    if (isKnownFormat(known)) {
      return known;
    }
  }

  const lowerName = fileName.toLowerCase();
  const norm = headers.map(normalizeHeader);

  if (lowerName.endsWith('.xml') || mimeType.includes('xml')) {
    return 'woocommerce_xml';
  }

  if (
    norm.includes('handle') &&
    norm.includes('title') &&
    (norm.includes('variantsku') || norm.includes('variant sku'))
  ) {
    return 'shopify_csv';
  }

  if (
    norm.includes('urunkodu') ||
    norm.includes('ticimaxurunid') ||
    norm.includes('stokkodu')
  ) {
    return 'ticimax_csv';
  }

  if (
    norm.includes('post_title') ||
    norm.includes('_sku') ||
    norm.includes('wooproduct')
  ) {
    return 'woocommerce_csv';
  }

  if (
    norm.includes('entegraurunkodu') ||
    norm.includes('entegra_id') ||
    norm.includes('entegrakodu')
  ) {
    return 'entegra_json';
  }

  if (
    lowerName.endsWith('.json') ||
    mimeType.includes('json')
  ) {
    return 'generic_json';
  }

  if (
    lowerName.endsWith('.xlsx') ||
    lowerName.endsWith('.xls') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('excel')
  ) {
    return 'generic_excel';
  }

  return 'generic_csv';
}

function isKnownFormat(value: string): value is MigrationSourceFormat {
  return [
    'generic_csv',
    'generic_excel',
    'generic_json',
    'entegra_json',
    'woocommerce_xml',
    'woocommerce_csv',
    'shopify_csv',
    'ticimax_csv',
    'kolay_ik_json',
  ].includes(value);
}
