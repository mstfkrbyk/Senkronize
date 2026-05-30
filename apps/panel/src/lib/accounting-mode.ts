import type { AccountingMode } from '@/types/auth';

export type { AccountingMode };

/** Org veya auth yanıtında varsa öncelikli kullanılır */
export type AccountingModeSource = AccountingMode | null | undefined;

/**
 * Ön muhasebe modu: aktif ERP bağlantısı varsa harici ERP, yoksa yerel ön muhasebe.
 */
export function resolveAccountingMode(
  orgAccountingMode: AccountingModeSource,
  activeErpConnectionCount: number,
): AccountingMode {
  if (orgAccountingMode === 'NATIVE' || orgAccountingMode === 'EXTERNAL_ERP') {
    return orgAccountingMode;
  }
  return activeErpConnectionCount > 0 ? 'EXTERNAL_ERP' : 'NATIVE';
}

export function countActiveErpConnections(
  connections: readonly { isActive: boolean }[] | undefined,
): number {
  return (connections ?? []).filter((c) => c.isActive).length;
}
