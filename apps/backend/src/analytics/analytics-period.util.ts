export interface AnalyticsDateRange {
  from: Date;
  to: Date;
  days: number;
}

export interface AnalyticsPreviousRange {
  current: AnalyticsDateRange;
  previous: AnalyticsDateRange;
}

/** `30d`, `7d`, `90d` veya gün sayısı (ör. `30`). */
export function parsePeriodDays(period: string | undefined, fallback = 30): number {
  if (!period || period.trim().length === 0) {
    return fallback;
  }
  const trimmed = period.trim().toLowerCase();
  const match = /^(\d+)\s*d$/.exec(trimmed);
  if (match?.[1]) {
    return Math.min(Math.max(Number.parseInt(match[1], 10), 1), 365);
  }
  const n = Number.parseInt(trimmed, 10);
  if (Number.isFinite(n) && n > 0) {
    return Math.min(n, 365);
  }
  return fallback;
}

export function rangeForDays(days: number): AnalyticsDateRange {
  const safeDays = Math.min(Math.max(days, 1), 365);
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - (safeDays - 1));
  return { from, to, days: safeDays };
}

export function rangeWithPrevious(days: number): AnalyticsPreviousRange {
  const current = rangeForDays(days);
  const spanMs = current.to.getTime() - current.from.getTime() + 1;
  const prevTo = new Date(current.from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - spanMs + 1);
  return {
    current,
    previous: { from: prevFrom, to: prevTo, days },
  };
}
