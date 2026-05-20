/**
 * ERP form alanlarını API/adaptörün beklediği credential anahtarlarına dönüştürür.
 */
export function normalizeErpCredentials(
  erpType: string,
  raw: Record<string, string>,
): Record<string, string> {
  const type = erpType.toUpperCase();

  if (type === 'LOGO' || type === 'LOGO_TIGER') {
    const host = (raw.host ?? raw.ip ?? '').trim();
    const port = (raw.port ?? '8080').trim();
    const existingUrl = (raw.baseUrl ?? '').trim();
    let baseUrl = existingUrl;
    if (!baseUrl && host) {
      const normalizedHost = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      baseUrl = normalizedHost.includes(':')
        ? `http://${normalizedHost}`
        : `http://${normalizedHost}:${port}`;
    }
    const out: Record<string, string> = {};
    if (baseUrl) {
      out.baseUrl = baseUrl;
    }
    if (raw.username?.trim()) {
      out.username = raw.username.trim();
    }
    if (raw.password) {
      out.password = raw.password;
    }
    if (raw.firmNo?.trim()) {
      out.firmNo = raw.firmNo.trim();
    }
    if (raw.dbName?.trim()) {
      out.dbName = raw.dbName.trim();
    }
    return out;
  }

  if (type === 'MIKRO') {
    const connectionString = (raw.connectionString ?? '').trim();
    const host = (raw.host ?? raw.ip ?? '').trim();
    const port = (raw.port ?? '8080').trim();
    const existingUrl = (raw.baseUrl ?? '').trim();
    let baseUrl = existingUrl;
    if (!baseUrl && connectionString) {
      baseUrl = connectionString.startsWith('http')
        ? connectionString
        : `http://${connectionString}`;
    } else if (!baseUrl && host) {
      const normalizedHost = host.replace(/^https?:\/\//, '').replace(/\/+$/, '');
      baseUrl = normalizedHost.includes(':')
        ? `http://${normalizedHost}`
        : `http://${normalizedHost}:${port}`;
    }
    const out: Record<string, string> = {};
    if (baseUrl) {
      out.baseUrl = baseUrl;
    }
    if (connectionString) {
      out.connectionString = connectionString;
    }
    if (raw.username?.trim()) {
      out.username = raw.username.trim();
    }
    if (raw.password) {
      out.password = raw.password;
    }
    if (raw.dbName?.trim()) {
      out.dbName = raw.dbName.trim();
    }
    return out;
  }

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      out[key] = trimmed;
    }
  }
  return out;
}
