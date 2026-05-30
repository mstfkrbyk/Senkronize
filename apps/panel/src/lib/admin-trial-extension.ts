export const TRIAL_EXTEND_DAYS = 7;
export const TRIAL_EXTEND_REASON = 'Admin: deneme süresi 7 gün uzatıldı';

/** Deneme bitişine `days` ekler; süre dolmuşsa bugünden sayar. */
export function trialEndsAtPlusDays(
  currentIso: string | null,
  days: number,
): string {
  const now = Date.now();
  let base = currentIso ? new Date(currentIso) : new Date();
  if (Number.isNaN(base.getTime())) {
    base = new Date();
  }
  const startMs = base.getTime() < now ? now : base.getTime();
  const next = new Date(startMs);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}
