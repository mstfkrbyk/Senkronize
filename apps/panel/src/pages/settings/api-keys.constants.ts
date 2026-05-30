export const API_KEY_PERMISSIONS = [
  {
    value: 'orders:read',
    labelKey: 'settings.apiKeys.permissions.ordersRead',
    label: 'Sipariş okuma',
  },
  {
    value: 'orders:write',
    labelKey: 'settings.apiKeys.permissions.ordersWrite',
    label: 'Sipariş yazma',
  },
  {
    value: 'products:read',
    labelKey: 'settings.apiKeys.permissions.productsRead',
    label: 'Ürün okuma',
  },
  {
    value: 'products:write',
    labelKey: 'settings.apiKeys.permissions.productsWrite',
    label: 'Ürün yazma',
  },
  {
    value: 'stock:read',
    labelKey: 'settings.apiKeys.permissions.stockRead',
    label: 'Stok okuma',
  },
  {
    value: 'stock:write',
    labelKey: 'settings.apiKeys.permissions.stockWrite',
    label: 'Stok yazma',
  },
  {
    value: 'webhooks:manage',
    labelKey: 'settings.apiKeys.permissions.webhooksManage',
    label: 'Webhook yönetimi',
  },
  {
    value: 'reports:read',
    labelKey: 'settings.apiKeys.permissions.reportsRead',
    label: 'Rapor okuma',
  },
] as const;

/** Bilinmeyen veya i18n dışı izin kodları için Türkçe yedek etiketler. */
export const API_KEY_PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  API_KEY_PERMISSIONS.map((p) => [p.value, p.label]),
);

export function apiKeyPermissionLabel(
  permission: string,
  t?: (key: string) => string,
): string {
  const item = API_KEY_PERMISSIONS.find((p) => p.value === permission);
  if (item && t) {
    const translated = t(item.labelKey);
    if (translated !== item.labelKey) {
      return translated;
    }
  }
  return API_KEY_PERMISSION_LABELS[permission] ?? permission;
}

/** Backend şu an yalnızca bu izinleri kabul eder (reports:read henüz yok). */
export const API_KEY_PERMISSIONS_ACCEPTED = [
  'orders:read',
  'orders:write',
  'products:read',
  'products:write',
  'stock:read',
  'stock:write',
  'webhooks:manage',
] as const;

export type ApiKeyPermission = (typeof API_KEY_PERMISSIONS)[number]['value'];

export interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  permissions?: string[];
}

export interface CreatedApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  key: string;
}

export interface CreateApiKeyInput {
  name: string;
  permissions: ApiKeyPermission[];
  expiresAt?: string;
}

const PERMISSIONS_STORAGE_KEY = 'senkronize-api-key-permissions';

export function readStoredApiKeyPermissions(id: string): string[] | undefined {
  try {
    const raw = sessionStorage.getItem(PERMISSIONS_STORAGE_KEY);
    if (!raw) {
      return undefined;
    }
    const map = JSON.parse(raw) as Record<string, string[]>;
    return map[id];
  } catch {
    return undefined;
  }
}

export function writeStoredApiKeyPermissions(id: string, permissions: string[]): void {
  try {
    const raw = sessionStorage.getItem(PERMISSIONS_STORAGE_KEY);
    const map: Record<string, string[]> = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    map[id] = permissions;
    sessionStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // sessionStorage kullanılamıyorsa sessizce atla
  }
}

export function removeStoredApiKeyPermissions(id: string): void {
  try {
    const raw = sessionStorage.getItem(PERMISSIONS_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const map = JSON.parse(raw) as Record<string, string[]>;
    delete map[id];
    sessionStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function sanitizePermissionsForApi(permissions: ApiKeyPermission[]): string[] {
  const accepted = new Set<string>(API_KEY_PERMISSIONS_ACCEPTED);
  return permissions.filter((p) => accepted.has(p));
}

export function formatApiKeyDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString('tr-TR');
  } catch {
    return '—';
  }
}
