export interface ErpCredentialField {
  key: string;
  label: string;
  type: 'text' | 'password';
  placeholder?: string;
  required: boolean;
}

export interface ErpOption {
  id: string;
  label: string;
  logo: string;
  fields: ErpCredentialField[];
}

export const ERP_OPTIONS: ErpOption[] = [
  {
    id: 'BIZIMHESAP',
    label: 'BizimHesap',
    logo: '📊',
    fields: [
      {
        key: 'apiToken',
        label: 'API Token',
        type: 'password',
        required: true,
      },
      { key: 'companyId', label: 'Firma ID', type: 'text', required: true },
    ],
  },
  {
    id: 'PARASUT',
    label: 'Paraşüt',
    logo: '🧾',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'password',
        required: true,
      },
      { key: 'companyId', label: 'Şirket ID', type: 'text', required: true },
    ],
  },
  {
    id: 'TSOFT',
    label: 'T-Soft',
    logo: '🏬',
    fields: [
      {
        key: 'storeUrl',
        label: 'Mağaza URL',
        type: 'text',
        placeholder: 'https://magaza.com',
        required: true,
      },
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
      },
    ],
  },
  {
    id: 'TICIMAX',
    label: 'Ticimax',
    logo: '🛒',
    fields: [
      { key: 'siteUrl', label: 'Site URL', type: 'text', required: true },
      {
        key: 'username',
        label: 'Kullanıcı Adı',
        type: 'text',
        required: true,
      },
      {
        key: 'password',
        label: 'Şifre',
        type: 'password',
        required: true,
      },
    ],
  },
  {
    id: 'LOGO',
    label: 'Logo Tiger/Go',
    logo: '🐯',
    fields: [
      {
        key: 'baseUrl',
        label: 'Sunucu URL',
        type: 'text',
        placeholder: 'http://192.168.1.100:8181',
        required: true,
      },
      { key: 'username', label: 'Kullanıcı Adı', type: 'text', required: true },
      {
        key: 'password',
        label: 'Şifre',
        type: 'password',
        required: true,
      },
      { key: 'firmNo', label: 'Firma No', type: 'text', required: true },
      { key: 'periodNo', label: 'Dönem No', type: 'text', required: true },
    ],
  },
  {
    id: 'MIKRO',
    label: 'Mikro ERP',
    logo: '⚙️',
    fields: [
      { key: 'baseUrl', label: 'Sunucu URL', type: 'text', required: true },
      { key: 'username', label: 'Kullanıcı Adı', type: 'text', required: true },
      {
        key: 'password',
        label: 'Şifre',
        type: 'password',
        required: true,
      },
      { key: 'dbName', label: 'Veritabanı Adı', type: 'text', required: true },
    ],
  },
  {
    id: 'NETSIS',
    label: 'Netsis',
    logo: '🏢',
    fields: [
      {
        key: 'baseUrl',
        label: 'Sunucu URL',
        type: 'text',
        placeholder: 'http://192.168.1.10',
        required: true,
      },
      { key: 'username', label: 'Kullanıcı Adı', type: 'text', required: true },
      {
        key: 'password',
        label: 'Şifre',
        type: 'password',
        required: true,
      },
      {
        key: 'databaseAlias',
        label: 'Veritabanı (Alias)',
        type: 'text',
        required: true,
      },
    ],
  },
  {
    id: 'LUCA',
    label: 'Luca Muhasebe',
    logo: '☁️',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        required: true,
      },
      { key: 'companyId', label: 'Firma ID', type: 'text', required: true },
    ],
  },
  {
    id: 'ETA',
    label: 'ETA V8',
    logo: '📒',
    fields: [
      {
        key: 'baseUrl',
        label: 'API taban URL (veya aşağıda host)',
        type: 'text',
        placeholder: 'http://192.168.1.10:8080/eta/api',
        required: false,
      },
      { key: 'host', label: 'Sunucu (host)', type: 'text', required: false },
      { key: 'port', label: 'Port', type: 'text', placeholder: '80', required: false },
      { key: 'username', label: 'Kullanıcı Adı', type: 'text', required: true },
      { key: 'password', label: 'Şifre', type: 'password', required: true },
    ],
  },
  {
    id: 'KOLAYBI',
    label: 'Kolaybi',
    logo: '☁️',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key (X-Api-Key)',
        type: 'password',
        required: true,
      },
      {
        key: 'companyName',
        label: 'Hesap etiketi (isteğe bağlı)',
        type: 'text',
        required: false,
      },
      {
        key: 'workspaceId',
        label: 'Çalışma alanı ID (isteğe bağlı)',
        type: 'text',
        required: false,
      },
    ],
  },
  {
    id: 'ZIRVE',
    label: 'Zirve ERP',
    logo: '📈',
    fields: [
      {
        key: 'baseUrl',
        label: 'API taban URL',
        type: 'text',
        placeholder: 'http://192.168.1.10:8080/zirve/api',
        required: false,
      },
      { key: 'host', label: 'Sunucu (host)', type: 'text', required: false },
      { key: 'port', label: 'Port', type: 'text', placeholder: '8080', required: false },
      {
        key: 'token',
        label: 'Sabit token (varsa, giriş atlanır)',
        type: 'password',
        required: false,
      },
      { key: 'username', label: 'Kullanıcı Adı', type: 'text', required: false },
      {
        key: 'password',
        label: 'Şifre',
        type: 'password',
        required: false,
      },
    ],
  },
  {
    id: 'NEBIM',
    label: 'Nebim V3',
    logo: '🛍️',
    fields: [
      {
        key: 'baseUrl',
        label: 'Web servis kök URL',
        type: 'text',
        placeholder: 'http://192.168.1.10/NebimV3WS',
        required: false,
      },
      { key: 'host', label: 'Sunucu (host)', type: 'text', required: false },
      {
        key: 'useHttps',
        label: 'HTTPS kullan (true/false)',
        type: 'text',
        placeholder: 'false',
        required: false,
      },
      { key: 'username', label: 'Kullanıcı Adı', type: 'text', required: true },
      { key: 'password', label: 'Şifre', type: 'password', required: true },
    ],
  },
  {
    id: 'EBA',
    label: 'eBA',
    logo: '📄',
    fields: [
      { key: 'clientId', label: 'OAuth Client ID', type: 'text', required: true },
      {
        key: 'clientSecret',
        label: 'OAuth Client Secret',
        type: 'password',
        required: true,
      },
      {
        key: 'apiBaseUrl',
        label: 'API taban URL (isteğe bağlı)',
        type: 'text',
        placeholder: 'https://api.eba.com.tr/v1',
        required: false,
      },
      {
        key: 'oauthTokenUrl',
        label: 'Token URL (isteğe bağlı)',
        type: 'text',
        required: false,
      },
      {
        key: 'triggerApprovalFlow',
        label: 'Onay akışı tetikle (true/false)',
        type: 'text',
        required: false,
      },
    ],
  },
  {
    id: 'SAP_B1',
    label: 'SAP Business One',
    logo: '🏢',
    fields: [
      {
        key: 'baseUrl',
        label: 'Service Layer URL',
        type: 'text',
        placeholder: 'https://sunucu:50000/b1s/v1',
        required: true,
      },
      { key: 'companyDB', label: 'Şirket veritabanı', type: 'text', required: true },
      { key: 'username', label: 'Kullanıcı Adı', type: 'text', required: true },
      { key: 'password', label: 'Şifre', type: 'password', required: true },
    ],
  },
  {
    id: 'ISNET',
    label: 'İşnet ERP',
    logo: '🔗',
    fields: [
      { key: 'baseUrl', label: 'API taban URL', type: 'text', required: true },
      {
        key: 'apiKey',
        label: 'API Key (Bearer)',
        type: 'password',
        required: false,
      },
      { key: 'username', label: 'Kullanıcı Adı (Basic)', type: 'text', required: false },
      {
        key: 'password',
        label: 'Şifre (Basic)',
        type: 'password',
        required: false,
      },
    ],
  },
];

export function getErpBranding(erpType: string): {
  label: string;
  logo: string;
  accountFieldLabel: string;
} {
  const opt = ERP_OPTIONS.find((o) => o.id === erpType);
  if (opt) {
    return {
      label: opt.label,
      logo: opt.logo,
      accountFieldLabel: opt.fields[0]?.label ?? 'Hesap',
    };
  }
  return { label: erpType, logo: '🔗', accountFieldLabel: 'Hesap' };
}
