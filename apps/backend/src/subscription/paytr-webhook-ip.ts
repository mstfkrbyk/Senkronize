function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return -1;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipv4MatchesCidr(ip: string, cidr: string): boolean {
  const [range, bitsRaw] = cidr.split('/');
  const bits = parseInt(bitsRaw ?? '32', 10);
  if (Number.isNaN(bits) || bits < 0 || bits > 32) {
    return false;
  }
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range.trim());
  if (ipInt < 0 || rangeInt < 0) {
    return false;
  }
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

/**
 * PayTR bildirim isteğinin kaynak IP'sinin izin verilen listeyle eşleşip eşleşmediğini kontrol eder.
 * Kurallar: virgülle ayrılmış `85.111.0.0/16` veya tam IPv4 (`1.2.3.4`).
 */
export function isPaytrWebhookIpAllowed(
  ip: string,
  allowlistCsv: string | undefined,
): boolean {
  const raw = allowlistCsv?.trim();
  if (!raw) {
    return false;
  }
  const normalized = ip.replace(/^::ffff:/, '');
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(normalized)) {
    return false;
  }
  const rules = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const rule of rules) {
    if (rule.includes('/')) {
      if (ipv4MatchesCidr(normalized, rule)) {
        return true;
      }
    } else if (normalized === rule) {
      return true;
    }
  }
  return false;
}
