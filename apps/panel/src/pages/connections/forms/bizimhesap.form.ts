import type { ConnectionFormFieldDef } from '@/lib/connection-form-field.types';

/** BizimHesap B2B API — https://bizimhesap.com/api/b2b */
export const BIZIMHESAP_CONNECTION_FORM_FIELDS: ConnectionFormFieldDef[] = [
  {
    key: 'token',
    label: 'API Token',
    type: 'password',
    required: true,
    placeholder: 'Örn. 485E152158494BE590B5F72403398765',
    hint: 'BizimHesap panelinde Ayarlar → API/Entegrasyon bölümündeki tek token. Bağlantı testi, ürün/stok senkronu ve fatura için aynı değer kullanılır.',
  },
  {
    key: 'defaultCustomerCode',
    label: 'Varsayılan Müşteri Başlığı',
    type: 'text',
    required: false,
    placeholder: 'Örn. Perakende Müşteri',
    hint: 'Fatura oluştururken müşteri bilgisi yoksa kullanılacak isim (opsiyonel).',
  },
];
