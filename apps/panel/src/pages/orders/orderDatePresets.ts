import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export type OrderDatePreset = 'today' | 'week' | 'month' | 'custom';

export function resolveOrderDatePreset(
  preset: OrderDatePreset,
): { startDate: string; endDate: string } | null {
  const now = new Date();
  switch (preset) {
    case 'today':
      return {
        startDate: format(startOfDay(now), 'yyyy-MM-dd'),
        endDate: format(endOfDay(now), 'yyyy-MM-dd'),
      };
    case 'week':
      return {
        startDate: format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        endDate: format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      };
    case 'month':
      return {
        startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
        endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
      };
    case 'custom':
    default:
      return null;
  }
}

export const ORDER_DATE_PRESET_LABELS: Record<OrderDatePreset, string> = {
  today: 'Bugün',
  week: 'Bu Hafta',
  month: 'Bu Ay',
  custom: 'Özel',
};
