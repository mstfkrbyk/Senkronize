import type { TFunction } from 'i18next';

/** 1-based month index (1 = January). */
export function commissionMonthLabel(month: number, t: TFunction): string {
  const key = `partner.commission.months.${month}`;
  const label = t(key);
  return label === key ? String(month) : label;
}

export function commissionPeriodLabel(
  year: number,
  month: number,
  t: TFunction,
): string {
  return `${commissionMonthLabel(month, t)} ${year}`;
}
