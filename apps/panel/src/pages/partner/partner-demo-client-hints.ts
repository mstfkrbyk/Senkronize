import type { TFunction } from 'i18next';

import i18n from '@/i18n';

const DEMO_CLIENT_SLUG_ORDER = [
  'demo-partner-musteri',
  'demo-partner-musteri-2',
] as const;

function resolveT(t?: TFunction): TFunction {
  if (t) {
    return t;
  }
  return ((key: string, options?: Record<string, unknown>) =>
    i18n.t(key, { lng: 'tr', ...options })) as TFunction;
}

/** Seed demo müşteri slug → kart alt açıklaması (`partner@partner.com` denemesi). */
export function partnerDemoClientHint(
  slug: string | undefined,
  t?: TFunction,
): string | null {
  if (!slug) {
    return null;
  }
  const tr = resolveT(t);
  const hint = tr(`admin.pages.partnerClients.demoHint.${slug}`, { defaultValue: '' });
  return hint.length > 0 ? hint : null;
}

/** Demo müşteri kartlarını öngörülebilir sırada göster. */
export function comparePartnerDemoClientSlug(a: string, b: string): number {
  const ai = DEMO_CLIENT_SLUG_ORDER.indexOf(
    a as (typeof DEMO_CLIENT_SLUG_ORDER)[number],
  );
  const bi = DEMO_CLIENT_SLUG_ORDER.indexOf(
    b as (typeof DEMO_CLIENT_SLUG_ORDER)[number],
  );
  if (ai >= 0 && bi >= 0) {
    return ai - bi;
  }
  if (ai >= 0) {
    return -1;
  }
  if (bi >= 0) {
    return 1;
  }
  return a.localeCompare(b, 'tr');
}
