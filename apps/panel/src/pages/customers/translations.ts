export const customersTr = {
  list: {
    subtitle: {
      native: 'Cari hesap bakiyeleri ve müşteri segmentasyonu ile yönetin.',
      integration:
        'Pazaryeri müşterilerinizi sipariş geçmişi ve segmentasyon ile yönetin.',
    },
    columns: {
      orders: 'Sipariş',
      spent: 'Harcama',
      debit: 'Borç',
      credit: 'Alacak',
      balance: 'Bakiye',
    },
    kpi: {
      customerCount: 'Cari müşteri',
      totalDebit: 'Toplam borç',
      totalCredit: 'Toplam tahsilat',
      netBalance: 'Net bakiye',
    },
    error: {
      loadFailed: 'Müşteriler yüklenemedi',
      balanceSummaryFailed: 'Cari özet yüklenemedi',
      ledgerFailed: 'Bakiye yüklenemedi',
    },
    empty: {
      title: 'Henüz müşteri yok',
      descriptionNative:
        'Manuel müşteri ekleyebilir veya faturalardan cari kayıt oluşturabilirsiniz.',
      descriptionIntegration:
        'Siparişler senkronize edildikçe müşteri kayıtları otomatik oluşturulur.',
    },
    export: {
      csv: 'CSV dışa aktar',
      successNative: 'Cari listesi CSV olarak indirildi.',
      successIntegration: 'Müşteri listesi indirildi.',
      noData: 'Dışa aktarılacak müşteri yok.',
    },
  },
  segments: {
    pageTitle: 'Müşteri Segmentleri',
    subtitle:
      'Otomatik segmentasyon: harcama, sipariş sıklığı ve son aktiviteye göre.',
    guard: {
      title: 'Segmentler entegrasyon modunda',
      description:
        'Pazaryeri segmentasyonu yalnızca entegrasyon (sipariş) modunda kullanılır. Cari müşteriler için müşteri listesine dönün.',
      back: 'Müşteri listesine dön',
    },
    error: {
      loadFailed: 'Segment verileri yüklenemedi',
    },
    empty: {
      chart: 'Henüz segmentlenecek müşteri yok.',
    },
    email: {
      button: 'Bu segmente e-posta gönder',
      tooltip: 'segmentine e-posta gönderimi yakında eklenecek.',
    },
    backToList: 'Müşteri listesine dön',
  },
  detail: {
    ledger: {
      title: 'Cari özeti',
    },
    externalErp: {
      bannerTitle: 'Cari kayıtları harici ERP programında',
      bannerDescription:
        'Müşteri borç ve tahsilat bilgileri Paraşüt, BizimHesap vb. bağlı muhasebe programınızda tutulur. Panelde cari ekstre bu modda gösterilmez; sipariş geçmişini Siparişler sekmesinden takip edebilirsiniz.',
      connectionsLink: 'ERP bağlantılarına git',
    },
  },
  statement: {
    tab: 'Cari Ekstre',
    guard: {
      title: 'Cari ekstre ön muhasebe modunda',
      description:
        'Müşteri borç ve tahsilat ekstresi yalnızca ön muhasebe (cari) modunda kullanılır. Pazaryeri entegrasyon modunda sipariş geçmişini Siparişler sekmesinden takip edebilirsiniz.',
      backToOrders: 'Siparişler sekmesine git',
    },
    export: {
      csv: 'CSV dışa aktar',
      success: 'Cari ekstre CSV olarak indirildi.',
      noData: 'Dışa aktarılacak hareket yok.',
      summaryLabel: 'Özet',
    },
    summary: {
      totalDebit: 'Toplam borç',
      totalCredit: 'Toplam tahsilat',
      balance: 'Bakiye',
    },
    table: {
      date: 'Tarih',
      type: 'Tür',
      description: 'Açıklama',
      debit: 'Borç',
      credit: 'Alacak',
      balance: 'Bakiye',
    },
    lineType: {
      INVOICE: 'Fatura',
      PAYMENT: 'Tahsilat',
      CREDIT_NOTE: 'Alacak dekontu',
      DEBIT_NOTE: 'Borç dekontu',
      ADJUSTMENT: 'Düzeltme',
      REFUND: 'İade',
    },
    empty: {
      noLinesTitle: 'Hareket kaydı yok',
      noLinesDescription:
        'Bu müşteri için cari hesap hareketi bulunmuyor. Fatura ve tahsilat kayıtları eklendikçe ekstre burada görünecek.',
      unavailableTitle: 'Cari ekstre henüz kullanılamıyor',
      unavailableDescription:
        'Ön muhasebe modülü API üzerinden hazır olduğunda müşteri borç/alacak hareketleri bu sekmede listelenecek.',
    },
    error: {
      loadFailed: 'Cari ekstre yüklenemedi',
    },
    retry: 'Tekrar dene',
  },
} as const;

function getNested(
  obj: Record<string, unknown>,
  path: string,
): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (typeof cur !== 'object' || cur === null || !(p in cur)) {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

const STATEMENT_LINE_TYPE_FALLBACKS: Record<string, string> = {
  INVOICE: 'Fatura',
  PAYMENT: 'Tahsilat',
  CREDIT_NOTE: 'Alacak dekontu',
  DEBIT_NOTE: 'Borç dekontu',
  ADJUSTMENT: 'Düzeltme',
  REFUND: 'İade',
};

export function customersT(key: string): string {
  return getNested(customersTr as unknown as Record<string, unknown>, key) ?? key;
}

/** Cari ekstre satır türü; eksik çeviri anahtarı yerine Türkçe etiket döner. */
export function statementLineTypeLabel(type: string): string {
  const key = `statement.lineType.${type}`;
  const nested = getNested(customersTr as unknown as Record<string, unknown>, key);
  if (nested) {
    return nested;
  }
  return STATEMENT_LINE_TYPE_FALLBACKS[type] ?? type;
}
