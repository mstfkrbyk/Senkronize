import type { UsageOverview } from '@/types/subscription';

export function isErpSlotQuotaFull(usage: UsageOverview | undefined): boolean {
  const limit = usage?.usage.erpConnections?.limit;
  const used = usage?.usage.erpConnections?.used ?? 0;
  if (limit == null) {
    return false;
  }
  return used >= limit;
}

export function erpSlotUsageLabel(usage: UsageOverview | undefined): string {
  const limit = usage?.usage.erpConnections?.limit;
  const used = usage?.usage.erpConnections?.used ?? 0;
  if (limit == null) {
    return `${String(used)} / sınırsız`;
  }
  return `${String(used)} / ${String(limit)}`;
}
