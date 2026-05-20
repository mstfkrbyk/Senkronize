export const MOVEMENT_LABELS: Record<string, string> = {
  SALE: 'Çıkış',
  RETURN: 'İade',
  PURCHASE: 'Giriş',
  ADJUSTMENT: 'Düzeltme',
  TRANSFER: 'Transfer',
  RESERVATION: 'Rezervasyon',
  RESERVATION_RELEASE: 'Rezervasyon iadesi',
  SYNC: 'Senkronizasyon',
};

/** UI filtre grupları → backend movementType */
export const MOVEMENT_FILTER_GROUPS: {
  value: string;
  label: string;
  types: string[];
}[] = [
  { value: 'IN', label: 'Giriş', types: ['PURCHASE', 'RETURN'] },
  { value: 'OUT', label: 'Çıkış', types: ['SALE'] },
  { value: 'TRANSFER', label: 'Transfer', types: ['TRANSFER'] },
  { value: 'ADJUSTMENT', label: 'Düzeltme', types: ['ADJUSTMENT'] },
  { value: 'COUNT', label: 'Sayım', types: ['ADJUSTMENT'] },
];

export function movementSourceLabel(
  movementType: string,
  orderId: string | null,
  note: string | null,
): string {
  if (orderId) {
    return 'Sipariş';
  }
  if (movementType === 'SYNC') {
    return 'Sync';
  }
  if (movementType === 'ADJUSTMENT') {
    const n = (note ?? '').toLowerCase();
    if (n.includes('sayım') || n.includes('sayim')) {
      return 'Sayım';
    }
    return 'Manuel';
  }
  if (movementType === 'TRANSFER') {
    return 'Transfer';
  }
  return 'Manuel';
}

export function movementBadgeClass(type: string, quantity: number): string {
  if (type === 'TRANSFER') {
    return 'border-sky-200 bg-sky-50 text-sky-900';
  }
  if (quantity >= 0) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-900';
  }
  return 'border-rose-200 bg-rose-50 text-rose-900';
}
