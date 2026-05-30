import { getMarketplaceDisplay } from '@/lib/platform-display';

/** Pazaryeri enum kodu → kullanıcıya gösterilen ad (Trendyol, Hepsiburada, …). */
export function marketplacePlatformLabel(platform: string): string {
  return getMarketplaceDisplay(platform).label;
}

/** Rapor ve tablo bileşenleriyle uyumlu kısa alias. */
export function platformDisplayName(code: string): string {
  return marketplacePlatformLabel(code);
}
