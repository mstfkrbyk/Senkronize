/** API yanıtlarında dizi alanlarının asla null/undefined dönmemesi için. */
export function ensureArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/** Sayısal API alanları — null/NaN yerine güvenli son sayı. */
export function ensureFiniteNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const n = Number(value);
    if (Number.isFinite(n)) {
      return n;
    }
  }
  if (
    value != null &&
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as { toNumber: () => number }).toNumber === 'function'
  ) {
    const n = (value as { toNumber: () => number }).toNumber();
    if (Number.isFinite(n)) {
      return n;
    }
  }
  return fallback;
}
