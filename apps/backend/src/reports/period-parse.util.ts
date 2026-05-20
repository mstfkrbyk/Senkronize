import { BadRequestException } from '@nestjs/common';

export interface DateRangeBounds {
  from: Date;
  to: Date;
  label: string;
}

/** `2026-05` → ay başı / sonu */
export function parseMonthPeriod(period: string): {
  year: number;
  month: number;
  start: Date;
  end: Date;
} {
  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) {
    throw new BadRequestException(
      'Dönem formatı YYYY-MM olmalıdır (ör. 2026-05)',
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new BadRequestException('Geçersiz ay dönemi');
  }
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { year, month, start, end };
}

/** `2026-Q1` → çeyrek başı / sonu */
export function parseQuarterPeriod(period: string): {
  year: number;
  quarter: 1 | 2 | 3 | 4;
  start: Date;
  end: Date;
} {
  const match = /^(\d{4})-Q([1-4])$/i.exec(period.trim());
  if (!match) {
    throw new BadRequestException(
      'Çeyrek formatı YYYY-Q1..Q4 olmalıdır (ör. 2026-Q1)',
    );
  }
  const year = Number(match[1]);
  const quarter = Number(match[2]) as 1 | 2 | 3 | 4;
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59, 999);
  return { year, quarter, start, end };
}

/** `30d`, `7d`, `90d` veya `YYYY-MM` */
export function parseRelativeOrMonthPeriod(period: string): DateRangeBounds {
  const rel = /^(\d+)d$/i.exec(period.trim());
  if (rel) {
    const days = Number(rel[1]);
    if (!Number.isFinite(days) || days < 1 || days > 366) {
      throw new BadRequestException('Geçersiz gün dönemi');
    }
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date(to);
    from.setDate(from.getDate() - days + 1);
    from.setHours(0, 0, 0, 0);
    return { from, to, label: `Son ${days} gün` };
  }
  if (/^\d{4}-\d{2}$/.test(period.trim())) {
    const { start, end, year, month } = parseMonthPeriod(period);
    return {
      from: start,
      to: end,
      label: `${year}-${String(month).padStart(2, '0')}`,
    };
  }
  throw new BadRequestException(
    'Dönem 30d / 7d / 90d veya YYYY-MM formatında olmalıdır',
  );
}
