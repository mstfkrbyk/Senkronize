import type { ProductVariantDto } from '@/types/product';

export type ProductVariant = ProductVariantDto;

export function parseAttributes(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') {
      out[k] = v;
    }
  }
  return out;
}

export function formatMoney(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  const n =
    typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  if (!Number.isFinite(n)) {
    return '—';
  }
  return `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
}

export function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const n =
    typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Stok seviyesine göre hücre arka plan sınıfı */
export function stockCellClass(stock: number): string {
  if (stock <= 0) {
    return 'bg-red-100 text-red-900 hover:bg-red-200';
  }
  if (stock <= 5) {
    return 'bg-orange-100 text-orange-900 hover:bg-orange-200';
  }
  if (stock <= 20) {
    return 'bg-yellow-100 text-yellow-900 hover:bg-yellow-200';
  }
  return 'bg-green-100 text-green-900 hover:bg-green-200';
}

export function extractMatrixAxes(
  variants: ProductVariant[],
): { colors: string[]; sizes: string[] } {
  const colorSet = new Set<string>();
  const sizeSet = new Set<string>();

  for (const v of variants) {
    const attrs = parseAttributes(v.attributes);
    const color = attrs.Renk ?? attrs.renk ?? attrs.Color ?? attrs.color;
    const size = attrs.Beden ?? attrs.beden ?? attrs.Size ?? attrs.size;
    if (color) {
      colorSet.add(color);
    }
    if (size) {
      sizeSet.add(size);
    }
  }

  const sortFn = (a: string, b: string): number =>
    a.localeCompare(b, 'tr', { sensitivity: 'base' });

  return {
    colors: [...colorSet].sort(sortFn),
    sizes: [...sizeSet].sort(sortFn),
  };
}

export function findVariantByColorSize(
  variants: ProductVariant[],
  color: string,
  size: string,
): ProductVariant | undefined {
  return variants.find((v) => {
    const attrs = parseAttributes(v.attributes);
    const c = attrs.Renk ?? attrs.renk ?? attrs.Color ?? attrs.color ?? '';
    const s = attrs.Beden ?? attrs.beden ?? attrs.Size ?? attrs.size ?? '';
    return c === color && s === size;
  });
}

/** Kartezyen çarpım */
export function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) {
    return [[]];
  }
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap((a) => curr.map((b) => [...a, b])),
    [[]],
  );
}
