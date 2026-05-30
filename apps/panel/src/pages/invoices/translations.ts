export const invoicesTr = {
  pageTitle: 'Faturalar',
  pageDescription:
    'Satış faturalarınızı listeleyin, siparişten oluşturun, PDF indirin ve ERP aktarımını takip edin.',
  stats: {
    total: 'Toplam fatura',
    monthCount: 'Bu ay fatura',
    monthRevenue: 'Bu ay gelir (kesildi/ödendi)',
    overdue: 'Vadesi geçmiş',
  },
  filters: {
    title: 'Filtreler',
    customer: 'Müşteri',
    customerPlaceholder: 'Müşteri adı veya fatura no…',
    status: 'Durum',
    statusAll: 'Tüm durumlar',
    dateRange: 'Tarih aralığı',
    startDate: 'Başlangıç',
    endDate: 'Bitiş',
    clear: 'Filtreleri temizle',
  },
  status: {
    DRAFT: 'Taslak',
    SENT: 'Kesildi',
    PAID: 'Ödendi',
    CANCELLED: 'İptal',
    OVERDUE: 'Vadesi geçmiş',
  },
  overdue: {
    warningTitle: 'Vadesi geçmiş fatura',
    warningWithDue:
      'Fatura vadesi {{dueDate}} tarihinde geçti. Tahsilatı Faturalar sayfasından takip edin.',
    warningNoDue: 'Fatura vadesi geçmiş. Tahsilatı Faturalar sayfasından takip edin.',
    listTitle: 'Vadesi geçmiş faturalar',
    listDescriptionOne: '1 faturanın vadesi geçti. Tahsilat için listeyi inceleyin.',
    listDescription: '{{count}} faturanın vadesi geçti. Tahsilat için listeyi inceleyin.',
    cronHint:
      'Vadesi geçmiş durumu, vade tarihi geçen kesilmiş faturalar için her gün 01:00’da otomatik güncellenir.',
    viewOverdue: 'Vadesi geçmiş faturaları gör',
    viewInvoices: 'Faturalara git',
  },
  erp: {
    column: 'ERP',
    parasut: 'Paraşüt',
    bizimhesap: 'BizimHesap',
    other: 'Diğer',
    notConnected: 'Bağlı değil',
    pending: 'Bekliyor',
    sent: 'Gönderildi',
    noOrder: 'Sipariş yok',
    send: "ERP'ye gönder",
    sending: 'Gönderiliyor…',
    sendSuccess: '{{erp}} faturası oluşturuldu: {{invoiceNo}}',
  },
  table: {
    invoiceNumber: 'Fatura No',
    customer: 'Müşteri',
    date: 'Tarih',
    amount: 'Tutar',
    status: 'Durum',
    order: 'Sipariş',
    actions: 'İşlemler',
    openDetail: 'Detayı aç',
    pdf: 'PDF indir',
    fromOrder: 'Siparişten',
  },
  externalErp: {
    bannerTitle: 'Faturalar harici ERP programında',
    bannerDescription:
      'Kesilen faturalar Paraşüt, BizimHesap vb. bağlı muhasebe programınızda tutulur. Panelde yerel fatura listesi bu modda gösterilmez; siparişleri ERP bağlantılarından aktarabilirsiniz.',
    connectionsLink: 'ERP bağlantılarına git',
    pageDescription:
      'Harici muhasebe modunda faturalar bağlı ERP programınızda yönetilir.',
    dialogClose: 'Kapat',
  },
  empty: {
    title: 'Henüz fatura yok',
    description:
      'Yeni fatura oluşturun veya teslim edilen siparişlerden fatura üretin.',
  },
  pagination: {
    summary: 'Toplam {{total}} kayıt — sayfa {{page}} / {{pages}}',
    prev: 'Önceki',
    next: 'Sonraki',
  },
  actions: {
    newInvoice: 'Yeni Fatura',
    fromOrder: 'Siparişten Oluştur',
    create: 'Oluştur',
    cancel: 'İptal',
    updateStatus: 'Durum güncelle',
    markIssued: 'Kesildi olarak işaretle',
    markCancelled: 'İptal et',
    issue: 'Kes',
    markPaid: 'Ödendi işaretle',
    markPaidButton: 'Ödendi',
  },
  paymentMethod: {
    label: 'Ödeme yöntemi',
    BANK_TRANSFER: 'Banka havalesi',
    CASH: 'Nakit',
    CARD: 'Kredi / banka kartı',
    CHECK: 'Çek',
    OTHER: 'Diğer',
  },
  bulk: {
    selected: '{{count}} fatura seçildi',
    clearSelection: 'Seçimi temizle',
    issueSuccess: '{{count}} fatura kesildi.',
    markPaidSuccess: '{{count}} fatura ödendi olarak işaretlendi.',
    partialSuccess: '{{success}} başarılı, {{failed}} başarısız',
    noDraftSelected: 'Seçili taslak fatura yok',
    noPayableSelected: 'Ödendi işaretlenecek uygun fatura yok',
    confirmIssueTitle: 'Toplu fatura kes',
    confirmIssueDescription:
      '{{count}} taslak fatura kesilecek. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?',
    confirmMarkPaidTitle: 'Toplu ödendi işaretle',
    confirmMarkPaidDescription:
      '{{count}} fatura ödendi olarak işaretlenecek. Devam etmek istiyor musunuz?',
    confirm: 'Onayla',
    cancel: 'Vazgeç',
  },
  create: {
    title: 'Yeni Fatura',
    customerName: 'Müşteri adı',
    lineName: 'Ürün / hizmet',
    quantity: 'Adet',
    unitPrice: 'Birim fiyat (TRY)',
    dueDate: 'Vade tarihi',
    dueDateRequired: 'Vade tarihi zorunludur.',
    dueDateInvalid: 'Geçerli bir vade tarihi seçin.',
    success: 'Fatura oluşturuldu.',
  },
  fromOrder: {
    title: 'Siparişten Fatura Oluştur',
    description: 'Faturası olmayan veya yeni kayıt açılacak siparişi seçin.',
    search: 'Sipariş no veya müşteri ara…',
    selectOrder: 'Sipariş seçin',
    noOrders: 'Uygun sipariş bulunamadı.',
    noOrdersDescription:
      'Kargoya verilmiş veya teslim edilmiş, henüz faturası olmayan siparişler burada listelenir.',
    success: 'Siparişten fatura oluşturuldu.',
    alreadyLinked: 'Bu siparişe bağlı fatura var',
  },
  detail: {
    title: 'Fatura Detayı',
    lines: 'Kalemler',
    product: 'Ürün / hizmet',
    qty: 'Adet',
    unitPrice: 'Birim fiyat',
    lineTotal: 'Satır toplamı',
    subtotal: 'Ara toplam',
    tax: 'KDV',
    total: 'Genel toplam',
    notes: 'Notlar',
    dueDate: 'Vade tarihi',
    dueDateNotSet: 'Belirtilmedi',
    statusActions: 'Fatura işlemleri',
    eArchive: 'e-Arşiv',
    yes: 'Evet',
    no: 'Hayır',
    viewOrder: 'Siparişe git',
    statusUpdated: 'Fatura durumu güncellendi.',
    pdfPreview: 'PDF önizleme',
    pdfPreviewLoading: 'PDF yükleniyor…',
    pdfPreviewError: 'PDF önizlemesi yüklenemedi.',
    pdfPreviewEmpty: 'Önizlenecek PDF bulunamadı.',
    pdfPopupBlocked:
      'Yeni sekme açılamadı. Tarayıcıda açılır pencerelere izin verin veya PDF indirin.',
    pdfOpenTab: 'Yeni sekmede aç',
    pdfDownload: 'PDF indir',
    pdfSuccess: 'PDF indirildi.',
    markPaidSuccess: 'Fatura ödendi olarak işaretlendi.',
    paidAt: 'Ödeme tarihi',
    paymentMethod: 'Ödeme yöntemi',
  },
  toast: {
    statusUpdated: 'Fatura durumu güncellendi.',
    issueSuccess: 'Fatura kesildi.',
    markPaidSuccess: 'Fatura ödendi olarak işaretlendi.',
  },
} as const;

export type InvoicesTranslationKey = keyof typeof invoicesTr;

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

export function invoicesT(
  key: string,
  vars?: Record<string, string | number>,
): string {
  const raw = getNested(invoicesTr as unknown as Record<string, unknown>, key) ?? key;
  if (!vars) {
    return raw;
  }
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replaceAll(`{{${k}}}`, String(v)),
    raw,
  );
}
