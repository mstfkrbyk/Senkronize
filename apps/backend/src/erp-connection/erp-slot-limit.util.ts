export const EXTRA_ERP_SLOT_ADDON_CODE = 'extra_erp_slot';

/** Pakete dahil ERP bağlantı sayısı (org başına toplam, tür bağımsız) */
export const INCLUDED_ERP_CONNECTION_SLOTS = 1;

export interface SubscriptionAddonEntry {
  code: string;
  quantity?: number;
}

export function parseSubscriptionAddons(raw: unknown): SubscriptionAddonEntry[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: SubscriptionAddonEntry[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      continue;
    }
    const code = (item as { code?: unknown }).code;
    if (typeof code !== 'string' || code.trim().length === 0) {
      continue;
    }
    const quantity = (item as { quantity?: unknown }).quantity;
    out.push({
      code: code.trim(),
      ...(typeof quantity === 'number' && Number.isFinite(quantity)
        ? { quantity: Math.max(1, Math.floor(quantity)) }
        : {}),
    });
  }
  return out;
}

export function countExtraErpSlots(addons: unknown): number {
  return parseSubscriptionAddons(addons)
    .filter((entry) => entry.code === EXTRA_ERP_SLOT_ADDON_CODE)
    .reduce((sum, entry) => sum + (entry.quantity ?? 1), 0);
}

export function mergeExtraErpSlotAddon(
  addons: unknown,
  quantityToAdd: number,
): SubscriptionAddonEntry[] {
  const qty = Math.max(1, Math.floor(quantityToAdd));
  const parsed = parseSubscriptionAddons(addons);
  const index = parsed.findIndex(
    (entry) => entry.code === EXTRA_ERP_SLOT_ADDON_CODE,
  );
  if (index >= 0) {
    parsed[index] = {
      code: EXTRA_ERP_SLOT_ADDON_CODE,
      quantity: (parsed[index].quantity ?? 1) + qty,
    };
    return parsed;
  }
  return [...parsed, { code: EXTRA_ERP_SLOT_ADDON_CODE, quantity: qty }];
}

/** null = sınırsız (iç hesap) */
export function effectiveErpSlotLimit(options: {
  subscription: { addons?: unknown } | null;
  isInternalAccount: boolean;
}): number | null {
  if (options.isInternalAccount) {
    return null;
  }
  return INCLUDED_ERP_CONNECTION_SLOTS + countExtraErpSlots(options.subscription?.addons);
}
