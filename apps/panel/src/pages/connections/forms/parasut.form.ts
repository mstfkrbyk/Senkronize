import type { ConnectionFormFieldDef } from '@/lib/connection-form-field.types';

/** Paraşüt ön muhasebe — OAuth kimlik bilgileri */
export const PARASUT_CONNECTION_FORM_FIELDS: ConnectionFormFieldDef[] = [
  {
    key: 'clientId',
    label: 'Client ID',
    type: 'text',
    required: true,
    hint: 'Paraşüt uygulama entegrasyonundan alınan istemci kimliği.',
  },
  {
    key: 'clientSecret',
    label: 'Client Secret',
    type: 'password',
    required: true,
  },
  {
    key: 'companyId',
    label: 'Şirket ID',
    type: 'text',
    required: true,
    placeholder: '123456',
    hint: "Paraşüt URL'deki şirket numaranız (örn. app.parasut.com/123456).",
  },
  {
    key: 'refreshToken',
    label: 'Refresh Token',
    type: 'password',
    required: false,
    hint: 'OAuth yetkilendirme sonrası alınan refresh token (opsiyonel; yoksa client_credentials kullanılır).',
  },
];
