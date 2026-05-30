import type { ProductSelection } from '@/lib/product-selection';

export interface ProductSelectionMenuGroup {
  title: string;
  items: readonly string[];
  /** Stok satırı bu grupta vurgulanır */
  stockInGroup: boolean;
}

export interface ProductSelectionMenuPreview {
  groups: readonly ProductSelectionMenuGroup[];
  /** NATIVE modda stok konumu — kısa açıklama */
  stockNote: string;
}

const ECOMMERCE_PREVIEW: readonly string[] = [
  'Kontrol paneli',
  'Siparişler',
  'Ürünler',
  'Stok',
  'Bağlantılar',
];

const ECOMMERCE_NO_STOCK_PREVIEW: readonly string[] = [
  'Kontrol paneli',
  'Siparişler',
  'Ürünler',
  'Bağlantılar',
];

const NATIVE_ACCOUNTING_PREVIEW: readonly string[] = [
  'Ön Muhasebe özeti',
  'Faturalar',
  'Müşteriler',
  'Raporlar',
  'Stok',
];

/** Kayıt / onboarding menü önizlemesi — varsayılan yerel ön muhasebe (NATIVE) modu */
export function getProductSelectionMenuPreview(
  selection: ProductSelection,
): ProductSelectionMenuPreview {
  switch (selection) {
    case 'INTEGRATION':
      return {
        groups: [
          {
            title: 'E-Ticaret',
            items: ECOMMERCE_PREVIEW,
            stockInGroup: true,
          },
        ],
        stockNote:
          'Stok menüsü «E-Ticaret» grubunda görünür; pazaryeri senkronu ve depo yönetimi buradan yapılır.',
      };
    case 'ACCOUNTING':
      return {
        groups: [
          {
            title: 'Ön Muhasebe',
            items: NATIVE_ACCOUNTING_PREVIEW,
            stockInGroup: true,
          },
        ],
        stockNote:
          'Ön muhasebe panelde kullanıldığında stok «Ön Muhasebe» grubunun altında listelenir; depo ve envanter buradan yönetilir.',
      };
    case 'BUNDLE':
      return {
        groups: [
          {
            title: 'E-Ticaret',
            items: ECOMMERCE_NO_STOCK_PREVIEW,
            stockInGroup: false,
          },
          {
            title: 'Ön Muhasebe',
            items: NATIVE_ACCOUNTING_PREVIEW,
            stockInGroup: true,
          },
        ],
        stockNote:
          'Pakette ön muhasebe paneldeyken stok «Ön Muhasebe» grubunda; sipariş ve pazaryeri işlemleri «E-Ticaret» grubundadır.',
      };
    default: {
      const _exhaustive: never = selection;
      return _exhaustive;
    }
  }
}
