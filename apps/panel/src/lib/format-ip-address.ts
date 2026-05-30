const LOCALHOST_IPS = new Set(['::1', '127.0.0.1', 'localhost', '0:0:0:0:0:0:0:1']);

/** Görüntüleme için IP adresini biçimlendirir (yerel bağlantılar dahil). */
export function formatIpAddress(ip: string | null | undefined): string {
  if (!ip) {
    return '—';
  }
  const normalized = ip.trim().toLowerCase();
  if (LOCALHOST_IPS.has(normalized)) {
    return 'Yerel bağlantı';
  }
  if (ip.length > 20) {
    return `${ip.slice(0, 17)}...`;
  }
  return ip;
}
