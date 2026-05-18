export interface PlatformDisplayMeta {
  label: string;
  logo: string;
  /** Tailwind renk adı — rozet / vurgu için */
  color: string;
}

export const MARKETPLACE_DISPLAY: Record<string, PlatformDisplayMeta> = {
  TRENDYOL: { label: 'Trendyol', logo: '🛍️', color: 'orange' },
  HEPSIBURADA: { label: 'Hepsiburada', logo: '🏪', color: 'amber' },
  N11: { label: 'N11', logo: '🔶', color: 'violet' },
  AMAZON_TR: { label: 'Amazon.com.tr', logo: '📦', color: 'amber' },
  AMAZON_EU: { label: 'Amazon Avrupa (SP-API)', logo: '📦', color: 'amber' },
  ALLEGRO: { label: 'Allegro', logo: '🇪🇺', color: 'orange' },
  WILDBERRIES: { label: 'Wildberries', logo: '🛒', color: 'violet' },
  OZON: { label: 'Ozon', logo: '🔵', color: 'blue' },
  NOON: { label: 'Noon', logo: '🌙', color: 'amber' },
  CDISCOUNT: { label: 'Cdiscount', logo: '🇫🇷', color: 'red' },
  KAUFLAND: { label: 'Kaufland', logo: '🏪', color: 'emerald' },
  CICEKSEPETI: { label: 'Çiçeksepeti', logo: '🌸', color: 'pink' },
  IDEASOFT: { label: 'İdeasoft', logo: '💡', color: 'sky' },
  PTTAVM: { label: 'PTT AVM', logo: '📬', color: 'blue' },
  PAZARAMA: { label: 'Pazarama', logo: '🛒', color: 'indigo' },
  TSOFT: { label: 'T-Soft', logo: '🏬', color: 'cyan' },
  TICIMAX: { label: 'Ticimax', logo: '🛒', color: 'teal' },
  WOOCOMMERCE: { label: 'WooCommerce', logo: '🟣', color: 'purple' },
  SHOPIFY: { label: 'Shopify', logo: '🛍️', color: 'emerald' },
  GETIR: { label: 'Getir', logo: '🟣', color: 'purple' },
  GRATIS: { label: 'Gratis', logo: '💄', color: 'rose' },
  BOYNER: { label: 'Boyner', logo: '👔', color: 'slate' },
  MORHIPO: { label: 'Morhipo', logo: '👗', color: 'fuchsia' },
  DOLAP: { label: 'Dolap', logo: '👜', color: 'lime' },
  EBAY: { label: 'eBay', logo: '🌐', color: 'yellow' },
  ETSY: { label: 'Etsy', logo: '🧵', color: 'orange' },
  TEMU: { label: 'Temu', logo: '📦', color: 'red' },
  SAHIBINDEN: { label: 'Sahibinden', logo: '🏷️', color: 'yellow' },
  TRENDYOL_GO: { label: 'Trendyol GO', logo: '⚡', color: 'orange' },
  BANABI: { label: 'Banabi', logo: '🛒', color: 'red' },
  A101: { label: 'A101 Online', logo: '🏷️', color: 'red' },
  ELEKTRA: { label: 'Elektra', logo: '🔌', color: 'blue' },
  ARCELIK: { label: 'Arçelik D2C', logo: '🏠', color: 'sky' },
  VESTEL: { label: 'Vestel D2C', logo: '📺', color: 'slate' },
  BIMAKILLI: { label: 'Bim Akıllı', logo: '🥬', color: 'green' },
  MIGROSHEMEN: { label: 'Migros Hemen', logo: '🚀', color: 'orange' },
  ROBOMARKT: { label: 'Robomarkt', logo: '🤖', color: 'cyan' },
  SHOPIGO: { label: 'Shopigo', logo: '🛍️', color: 'violet' },
  YEMEKSEPETI: { label: 'Yemeksepeti Market', logo: '🛒', color: 'orange' },
  GETIR_FOOD: { label: 'Getir Yemek', logo: '🍔', color: 'purple' },
  TRENDYOL_YEMEK: { label: 'Trendyol Yemek', logo: '🍽️', color: 'orange' },
  FUUDY: { label: 'Fuudy', logo: '🥬', color: 'emerald' },
  MODANISA: { label: 'Modanisa', logo: '🧕', color: 'rose' },
  SEFAMERVE: { label: 'Sefamerve', logo: '👗', color: 'pink' },
  LIDYANA: { label: 'Lidyana', logo: '👚', color: 'fuchsia' },
  ADDAX: { label: 'Addax', logo: '👔', color: 'slate' },
  VIVENSE: { label: 'Vivense', logo: '🛋️', color: 'amber' },
  CICEKSEPETI_EV: { label: 'Çiçeksepeti Ev', logo: '🏠', color: 'pink' },
  EVIDEA: { label: 'Evidea', logo: '🏡', color: 'cyan' },
  PORLAND: { label: 'Porland', logo: '🍽️', color: 'stone' },
};

export const ERP_DISPLAY: Record<string, PlatformDisplayMeta> = {
  BIZIMHESAP: { label: 'BizimHesap', logo: '📊', color: 'blue' },
  PARASUT: { label: 'Paraşüt', logo: '🧾', color: 'green' },
  LOGO: { label: 'Logo', logo: '🐯', color: 'orange' },
  MIKRO: { label: 'Mikro', logo: '⚙️', color: 'slate' },
  NETSIS: { label: 'Netsis', logo: '🏢', color: 'zinc' },
  LUCA: { label: 'Luca', logo: '☁️', color: 'sky' },
  ETA: { label: 'ETA', logo: '📒', color: 'stone' },
  KOLAYBI: { label: 'Kolaybi', logo: '☁️', color: 'cyan' },
  ZIRVE: { label: 'Zirve', logo: '📈', color: 'emerald' },
  NEBIM: { label: 'Nebim', logo: '🛍️', color: 'violet' },
  EBA: { label: 'eBA', logo: '📄', color: 'blue' },
  SAP_B1: { label: 'SAP Business One', logo: '🏢', color: 'blue' },
  ISNET: { label: 'İşnet', logo: '🔗', color: 'indigo' },
  TSOFT: { label: 'T-Soft (ERP)', logo: '🏬', color: 'cyan' },
  TICIMAX: { label: 'Ticimax (ERP)', logo: '🛒', color: 'teal' },
};

export function getMarketplaceDisplay(platform: string): PlatformDisplayMeta {
  return (
    MARKETPLACE_DISPLAY[platform] ?? {
      label: platform,
      logo: '🔗',
      color: 'slate',
    }
  );
}

export function getErpDisplay(erpType: string): PlatformDisplayMeta {
  return (
    ERP_DISPLAY[erpType] ?? {
      label: erpType,
      logo: '🔗',
      color: 'slate',
    }
  );
}
