/** C0 kontrol karakterlerini kaldırır (TAB/LF/CR ayrı işlenir). */
function stripCsvControlChars(value: string): string {
  let out = '';
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (
      code <= 0x08 ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f)
    ) {
      continue;
    }
    out += ch;
  }
  return out;
}

/** CSV hücreleri için güvenli metin (kontrol karakterleri ve satır sonları temizlenir). */
export function sanitizeCsvText(value: string): string {
  return stripCsvControlChars(value)
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .trim();
}
