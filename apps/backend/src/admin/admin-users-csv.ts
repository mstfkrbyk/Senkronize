import type { AdminUserListItem } from './admin.types';

export const ADMIN_USERS_CSV_HEADERS = [
  'Ad',
  'E-posta',
  'Rol',
  'Durum',
  'Son giriş',
  'Organizasyon',
  'Org slug',
  'Org ID',
  'Kayıt',
] as const;

export const ADMIN_USERS_EXPORT_MAX = 500;

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Sahip',
  ADMIN: 'Yönetici',
  MANAGER: 'Müdür',
  VIEWER: 'İzleyici',
  SUPER_ADMIN: 'Sistem yöneticisi',
};

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

function formatUserCsvDate(value: Date | null): string {
  if (!value || Number.isNaN(value.getTime())) {
    return '';
  }
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  const h = String(value.getHours()).padStart(2, '0');
  const min = String(value.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

function rowToCells(row: AdminUserListItem): string[] {
  const org = row.organization;
  return [
    row.name.trim() || '—',
    row.email,
    ROLE_LABELS[row.role] ?? row.role,
    row.suspended ? 'Askıda' : 'Aktif',
    formatUserCsvDate(row.lastLoginAt),
    org?.name?.trim() || '',
    org?.slug?.trim() || '',
    org?.id ?? '',
    formatUserCsvDate(row.createdAt),
  ];
}

export function buildAdminUsersCsv(rows: AdminUserListItem[]): string {
  const lines = [
    ADMIN_USERS_CSV_HEADERS.join(','),
    ...rows.map((row) =>
      rowToCells(row).map((cell) => escapeCsvCell(cell)).join(','),
    ),
  ];
  return `\uFEFF${lines.join('\n')}`;
}
