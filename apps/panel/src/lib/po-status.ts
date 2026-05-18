import type { POStatus } from '@/types/supply';

export const PO_STATUS_LABEL_TR: Record<POStatus, string> = {
  DRAFT: 'Taslak',
  SENT: 'Gönderildi',
  CONFIRMED: 'Onaylandı',
  PARTIALLY_RECEIVED: 'Kısmen teslim',
  RECEIVED: 'Teslim alındı',
  CANCELLED: 'İptal',
};

export function poStatusBadgeClass(status: POStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-800 border-slate-200';
    case 'SENT':
      return 'bg-sky-100 text-sky-900 border-sky-200';
    case 'CONFIRMED':
      return 'bg-indigo-100 text-indigo-900 border-indigo-200';
    case 'PARTIALLY_RECEIVED':
      return 'bg-amber-100 text-amber-950 border-amber-200';
    case 'RECEIVED':
      return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    case 'CANCELLED':
      return 'bg-red-100 text-red-900 border-red-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
