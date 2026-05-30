/** Pazaryeri platformlarını bağlantı ekranında bölgeye göre gruplar. */
export type MarketplaceRegionId =
  | 'turkey'
  | 'europe'
  | 'mena'
  | 'asia_pacific'
  | 'americas'
  | 'global'
  | 'food_delivery'
  | 'other';

export const MARKETPLACE_REGION_ORDER: MarketplaceRegionId[] = [
  'turkey',
  'europe',
  'mena',
  'asia_pacific',
  'americas',
  'global',
  'food_delivery',
  'other',
];

export const MARKETPLACE_REGION_LABEL_KEYS: Record<MarketplaceRegionId, string> = {
  turkey: 'connections.regions.turkey',
  europe: 'connections.regions.europe',
  mena: 'connections.regions.mena',
  asia_pacific: 'connections.regions.asiaPacific',
  americas: 'connections.regions.americas',
  global: 'connections.regions.global',
  food_delivery: 'connections.regions.foodDelivery',
  other: 'connections.regions.other',
};

const TURKEY_EXACT = new Set([
  'TRENDYOL',
  'HEPSIBURADA',
  'N11',
  'CICEKSEPETI',
  'AMAZON_TR',
  'PTTAVM',
  'PAZARAMA',
  'GETIR',
  'GRATIS',
  'BOYNER',
  'FLO',
  'DEFACTO',
  'LCWAIKIKI',
  'KOCTAS',
  'KARACA',
  'MADAME_COCO',
  'ENGLISH_HOME',
  'GARDENA',
  'OBI_TR',
  'BAUHAUS_TR',
  'WATSONS_TR',
  'TEKNOSA',
  'MEDIAMARKT_TR',
  'MIGROS_HIZLI',
  'GETIR_MARKET',
  'MORHIPO',
  'DOLAP',
  'SAHIBINDEN',
  'TRENDYOL_GO',
  'TRENDYOL_SECOND_HAND',
  'BANABI',
  'A101',
  'ELEKTRA',
  'ARCELIK',
  'VESTEL',
  'BIMAKILLI',
  'MIGROSHEMEN',
  'ROBOMARKT',
  'SHOPIGO',
  'MODANISA',
  'SEFAMERVE',
  'LIDYANA',
  'ADDAX',
  'VIVENSE',
  'CICEKSEPETI_EV',
  'EVIDEA',
  'PORLAND',
  'GITTIGIDIYOR',
  'KITAPYURDU',
  'DR',
  'SPORTIVE',
  'ENPARA',
  'HEPSIBURADA_PREMIUM',
  'TRENDYOL_PREMIUM',
  'PAZARAMA_PREMIUM',
  'N11_PRO',
  'TRENDYOL_INT',
  'MIGROS_SANAL',
  'CARREFOURSA',
  'BIM_ONLINE',
  'SOK_MARKET',
  'TAZE_DIREKT',
  'GORILLAS',
  'ALIBABA_TR',
  'TRENDYOL_MILLA',
  'SAHIBINDEN_PREMIUM',
  'SAHIBINDEN_PRO',
  'BULDUMBULDUM',
  'ALISVERIS_COM',
  'IDEFIX',
  'PAZAR365',
  'DOPING',
  'KOTON',
  'MAVI',
  'YARGICI',
  'ADIDAS_TR',
  'ZARA_TR',
  'HIZLIRESMI',
  'TEDARIKCI',
  'BUYUK_MAGAZA',
  'TOPTANEVI',
  'SAHIBINDEN_B2B',
  'TICIMAX_MP',
  'IKAS_MP',
]);

function matchesPattern(id: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(id));
}

export function getMarketplaceRegion(platformId: string): MarketplaceRegionId {
  if (TURKEY_EXACT.has(platformId) || /_TR$/.test(platformId)) {
    return 'turkey';
  }

  if (
    matchesPattern(platformId, [
      /YEMEK|_FOOD|FUUDY|GETIR_YEMEK|TRENDYOL_YEMEK|GOFOOD|PANDAMART|GRAB_MART|GRABMART/i,
    ])
  ) {
    return 'food_delivery';
  }

  if (
    matchesPattern(platformId, [
      /^AMAZON_(DE|FR|UK|EU)/,
      /^ZALANDO/,
      /^OTTO$/,
      /^BOL/,
      /^EMAG/,
      /^FNAC/,
      /^CDISCOUNT/,
      /^KAUFLAND/,
      /^IDEALO/,
      /^REALDE/,
      /^ALLEGRO/,
      /^WILDBERRIES/,
      /^OZON/,
      /^MANOMANO/,
      /^VEEPEE/,
      /^SPARTOO/,
      /^LAREDOUTE/,
      /^CARREFOUR_FR/,
      /^CASINO_FR/,
      /^LIDL/,
      /^ALDI/,
      /^CDON/,
      /^ELLOS/,
      /^DUSTIN/,
      /^KOMPLETT/,
      /^CENEO/,
      /^HEUREKA/,
      /^MALL_CZ/,
      /^PIGU/,
      /^PRICERUNNER/,
      /^LAMODA/,
      /^YANDEX_MARKET/,
      /^PRIVALIA/,
      /^BRAND_ALLEY/,
      /^SHOWROOMPRIVE/,
      /^VENTE_EXCLUSIVE/,
      /^ZALANDO_LOUNGE/,
      /^MADE_COM/,
      /^DECATHLON/,
    ])
  ) {
    return 'europe';
  }

  if (
    matchesPattern(platformId, [
      /^NOON/,
      /^NAMSHI/,
      /^JUMIA/,
      /^CARREFOUR_ME/,
      /^OUNASS/,
      /^SIVVI/,
      /^MUMZWORLD/,
      /^BOUTIQAAT/,
      /^AWOK/,
      /^KASPI/,
      /^UZUM/,
      /^LULU_ONLINE/,
      /^VIRGIN_MEGASTORE/,
    ])
  ) {
    return 'mena';
  }

  if (
    matchesPattern(platformId, [
      /^LAZADA/,
      /^SHOPEE/,
      /^TOKOPEDIA/,
      /^MEESHO/,
      /^JIOMART/,
      /^FLIPKART/,
      /^SNAPDEAL/,
      /^MYNTRA/,
      /^RAKUTEN/,
      /^QOO10/,
      /^COUPANG/,
      /^STREET11/,
      /^DARAZ/,
      /^BUKALAPAK/,
      /^JDID/,
      /^BLIBLI/,
      /^TIKI/,
      /^SENDO/,
      /^MERCARI_JP/,
      /^YAHOO_AUCTIONS/,
      /^ZOZOTOWN/,
      /^KAKAO/,
      /^ZALORA/,
      /^PGMALL/,
      /^KOGAN/,
      /^THEMARKET_NZ/,
      /^GRAB/,
      /^AKULAKU/,
      /^GOTO_BUSINESS/,
      /^CENTRAL_ONLINE/,
    ])
  ) {
    return 'asia_pacific';
  }

  if (
    matchesPattern(platformId, [
      /^AMAZON_(CA|US|JP)/,
      /^MERCADOLIBRE/,
      /^WALMART/,
      /^TARGET_PLUS/,
      /^BESTBUY/,
      /^WAYFAIR/,
      /^OVERSTOCK/,
      /^EBAY/,
      /^ETSY/,
      /^TEMU/,
      /^AMERICANAS/,
      /^MAGALU/,
      /^LINIO/,
      /^FALABELLA/,
      /^CASAS_BAHIA/,
      /^SUBMARINO/,
      /^RIPLEY/,
      /^COSTCO_CA/,
      /^HUDSONS_BAY/,
      /^LIVERPOOL_MX/,
      /^COPPEL/,
      /^CATCH_AU/,
      /^MYDEAL/,
      /^TRADEME/,
      /^INSTACART/,
      /^SHOPEE_BR/,
    ])
  ) {
    return 'americas';
  }

  if (
    matchesPattern(platformId, [
      /^ALIBABA/,
      /^GLOBAL_/,
      /^DHGATE/,
      /^MADEINCHINA/,
      /^EXPORTIFY/,
      /^INDIAMART/,
      /^TRADEINDIA/,
      /^EC21/,
      /^SPOCKET/,
      /^OBERLO/,
      /^AUTODS/,
      /^DOBA/,
      /^TIKTOK_SHOP/,
      /^PINTEREST/,
      /^INSTAGRAM_SHOP/,
      /^WHATSAPP_COMMERCE/,
    ])
  ) {
    return 'global';
  }

  return 'other';
}

export interface MarketplaceRegionGroup {
  regionId: MarketplaceRegionId;
  platformIds: string[];
}

export function groupMarketplacePlatformsByRegion(
  platformIds: readonly string[],
): MarketplaceRegionGroup[] {
  const buckets = new Map<MarketplaceRegionId, string[]>();
  for (const regionId of MARKETPLACE_REGION_ORDER) {
    buckets.set(regionId, []);
  }
  for (const id of platformIds) {
    const region = getMarketplaceRegion(id);
    buckets.get(region)!.push(id);
  }
  return MARKETPLACE_REGION_ORDER.map((regionId) => ({
    regionId,
    platformIds: buckets.get(regionId) ?? [],
  })).filter((g) => g.platformIds.length > 0);
}

export function filterPlatformIdsBySearch(
  platformIds: readonly string[],
  query: string,
  labelFor: (id: string) => string,
): string[] {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  if (!q) {
    return [...platformIds];
  }
  return platformIds.filter((id) => {
    const label = labelFor(id).toLocaleLowerCase('tr-TR');
    const normalizedId = id.replaceAll('_', ' ').toLocaleLowerCase('tr-TR');
    return label.includes(q) || normalizedId.includes(q);
  });
}
