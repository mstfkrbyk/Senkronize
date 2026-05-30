import type { ConnectionHealthStatus } from '@/types/connection-health';

/** Platform operasyon araçları — yalnızca Senkronize SUPER_ADMIN. */
export function canViewIntegrationOps(role: string | undefined | null): boolean {
  return role === 'SUPER_ADMIN';
}

const CUSTOMER_STATUS_LABELS: Record<ConnectionHealthStatus, string> = {
  active: 'Çalışıyor',
  warning: 'Kontrol ediliyor',
  error: 'Destek gerekebilir',
  inactive: 'Pasif',
};

/** Son kullanıcıya gösterilen sade durum metni (teknik hata/jargon yok). */
export function customerConnectionStatusLabel(
  status: ConnectionHealthStatus,
): string {
  return CUSTOMER_STATUS_LABELS[status];
}
