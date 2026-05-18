const TR_MAP: Record<string, string> = {
  ğ: 'g',
  Ğ: 'g',
  ü: 'u',
  Ü: 'u',
  ş: 's',
  Ş: 's',
  ı: 'i',
  İ: 'i',
  i: 'i',
  ö: 'o',
  Ö: 'o',
  ç: 'c',
  Ç: 'c',
};

export function slugifyCategoryName(raw: string): string {
  let s = raw.trim().toLowerCase();
  for (const [k, v] of Object.entries(TR_MAP)) {
    s = s.split(k).join(v);
  }
  s = s
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return s.length > 0 ? s : 'kategori';
}
