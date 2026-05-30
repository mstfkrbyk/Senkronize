import { getConnectionErrorHint } from '@/lib/connection-error-hints';

export interface ErpTestConnectionResult {
  connected: boolean;
  success: boolean;
  companyName?: string;
  version?: string;
  productCount?: number;
  responseTimeMs?: number;
  message?: string;
}

type RawErpTestPayload = {
  connected?: boolean;
  success?: boolean;
  companyName?: string;
  version?: string;
  productCount?: number;
  responseTimeMs?: number;
  message?: string;
  error?: string;
  data?: RawErpTestPayload;
};

/** API yanıtını (düz veya `{ data }` sarmalı) panel tipine çevirir. */
export function normalizeErpTestConnectionResult(
  raw: RawErpTestPayload,
): ErpTestConnectionResult {
  const inner =
    raw.data !== undefined && typeof raw.data === 'object' && !Array.isArray(raw.data)
      ? raw.data
      : raw;
  const success = inner.success === true;
  const connected = inner.connected ?? success;
  const message =
    typeof inner.message === 'string'
      ? inner.message
      : typeof inner.error === 'string'
        ? inner.error
        : undefined;

  return {
    connected,
    success,
    companyName: inner.companyName,
    version: inner.version,
    productCount: inner.productCount,
    responseTimeMs: inner.responseTimeMs,
    message,
  };
}

export function formatErpTestSuccessMessage(res: ErpTestConnectionResult): string {
  const parts: string[] = [];
  if (res.companyName?.trim()) {
    parts.push(res.companyName.trim());
  }
  if (res.version?.trim()) {
    parts.push(`Sürüm ${res.version.trim()}`);
  }
  if (res.responseTimeMs !== undefined && Number.isFinite(res.responseTimeMs)) {
    parts.push(`Yanıt ${Math.round(res.responseTimeMs)} ms`);
  }
  if (res.productCount !== undefined && res.productCount > 0) {
    parts.push(`${res.productCount} ürün erişilebilir`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Bağlantı doğrulandı.';
}

export function formatConnectionTestFailureMessage(
  message: string | undefined,
  fallback = 'Bağlantı testi başarısız oldu.',
): string {
  const trimmed = (message ?? '').trim();
  if (!trimmed) {
    return fallback;
  }
  const hint = getConnectionErrorHint(trimmed);
  return hint ? `${trimmed} ${hint}` : trimmed;
}
