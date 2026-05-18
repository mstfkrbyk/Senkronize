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
