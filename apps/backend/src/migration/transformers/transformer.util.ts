export function rowGet(
  row: Record<string, string>,
  keys: string[],
): string | undefined {
  const normalizedKeys = keys.map((k) =>
    k.trim().toLowerCase().replace(/\s+/g, ''),
  );
  for (const [col, val] of Object.entries(row)) {
    const nk = col.trim().toLowerCase().replace(/\s+/g, '').replace(/^\uFEFF/, '');
    if (normalizedKeys.includes(nk)) {
      const v = val?.trim();
      if (v !== undefined && v.length > 0) {
        return v;
      }
    }
  }
  return undefined;
}

export function parseDecimal(raw: string | undefined): number | null {
  if (!raw?.trim()) {
    return null;
  }
  const s = raw.trim().replace(',', '.');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

export function parseIntSafe(raw: string | undefined, fallback = 0): number {
  if (!raw?.trim()) {
    return fallback;
  }
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}
