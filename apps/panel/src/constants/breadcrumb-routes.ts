/** pathname → segment etiketi (statik rotalar) */
export const BREADCRUMB_LABELS: Record<string, string> = {
  '/dashboard': 'Gösterge Paneli',
  '/orders': 'Siparişler',
  '/returns': 'İadeler',
  '/customers': 'Müşteriler',
  '/customers/segments': 'Segmentler',
  '/listings': 'İlanlar',
  '/products': 'Ürünler',
  '/products/import': 'İçe Aktarma',
  '/product-matching': 'Ürün Eşleştirme',
  '/categories': 'Kategoriler',
  '/stock': 'Stok',
  '/stock/forecast': 'Stok Tahmini',
  '/stock/count': 'Stok Sayımı',
  '/suppliers': 'Tedarikçiler',
  '/purchase-orders': 'Satın Alma Siparişleri',
  '/pricing': 'Fiyatlandırma',
  '/campaigns': 'Kampanyalar',
  '/connections': 'Bağlantılar',
  '/sync-logs': 'Sync Durumu',
  '/sync/conflicts': 'Çakışmalar',
  '/notifications': 'Bildirimler',
  '/support': 'Destek',
  '/audit-logs': 'Aktivite Geçmişi',
  '/analytics': 'Analitik',
  '/reports': 'Raporlar',
  '/migration': 'Geçiş Sihirbazı',
  '/partner': 'Partner Paneli',
  '/settings': 'Ayarlar',
  '/settings/profile': 'Profil',
  '/settings/subscription': 'Abonelik',
};

/** Dinamik segment desenleri: regex → üst segment etiketi */
export const BREADCRUMB_DYNAMIC_PARENTS: {
  pattern: RegExp;
  parentPath: string;
  parentLabel: string;
}[] = [
  {
    pattern: /^\/products\/[^/]+$/,
    parentPath: '/products',
    parentLabel: 'Ürünler',
  },
  {
    pattern: /^\/customers\/[^/]+$/,
    parentPath: '/customers',
    parentLabel: 'Müşteriler',
  },
  {
    pattern: /^\/suppliers\/[^/]+$/,
    parentPath: '/suppliers',
    parentLabel: 'Tedarikçiler',
  },
  {
    pattern: /^\/purchase-orders\/[^/]+$/,
    parentPath: '/purchase-orders',
    parentLabel: 'Satın Alma Siparişleri',
  },
  {
    pattern: /^\/support\/[^/]+$/,
    parentPath: '/support',
    parentLabel: 'Destek',
  },
];
