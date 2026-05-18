/** Amazon SP-API Avrupa pazar yeri kimlikleri */
export const AMAZON_EU_MARKETPLACE_IDS = {
  DE: 'A1PA6795UKMFR9',
  FR: 'A13V1IB3VIYZZH',
  UK: 'A1F83G8C2ARO7P',
  IT: 'APJ6JRA9NG5V4',
  ES: 'A1RKKUPIHCS9HS',
} as const;

export const AMAZON_EU_MARKETPLACE_ID_SET = new Set<string>(
  Object.values(AMAZON_EU_MARKETPLACE_IDS),
);

/** MarketplaceId → para birimi (Listings Items fiyat yaması için) */
export const AMAZON_EU_MARKETPLACE_CURRENCY: Record<string, string> = {
  [AMAZON_EU_MARKETPLACE_IDS.DE]: 'EUR',
  [AMAZON_EU_MARKETPLACE_IDS.FR]: 'EUR',
  [AMAZON_EU_MARKETPLACE_IDS.IT]: 'EUR',
  [AMAZON_EU_MARKETPLACE_IDS.ES]: 'EUR',
  [AMAZON_EU_MARKETPLACE_IDS.UK]: 'GBP',
};
