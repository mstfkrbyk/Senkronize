import type { CargoProvider } from '@senkronize/shared';

export const CARGO_PROVIDER_OPTIONS: { value: CargoProvider; label: string }[] = [
  { value: 'YURTICI', label: 'Yurtiçi Kargo' },
  { value: 'ARAS', label: 'Aras Kargo' },
  { value: 'MNG', label: 'MNG Kargo' },
  { value: 'SURAT', label: 'Sürat Kargo' },
  { value: 'PTT', label: 'PTT Kargo' },
  { value: 'PTT_KARGO', label: 'PTT Kargo (PTT_KARGO)' },
  { value: 'UPS', label: 'UPS' },
  { value: 'DHL', label: 'DHL' },
  { value: 'DHL_PARCEL', label: 'DHL Parcel' },
  { value: 'FEDEX', label: 'FedEx' },
  { value: 'SENDEO', label: 'Sendeo' },
  { value: 'HEPSIJET', label: 'Hepsijet' },
  { value: 'TRENDYOL_EXPRESS', label: 'Trendyol Express' },
];

export function normalizeCargoProviderKey(
  provider?: string | null,
): CargoProvider | null {
  if (!provider || provider.trim().length === 0) {
    return null;
  }
  const key = provider.trim().toUpperCase().replace(/[\s-]+/g, '_');
  const found = CARGO_PROVIDER_OPTIONS.find((o) => o.value === key);
  return found?.value ?? null;
}
