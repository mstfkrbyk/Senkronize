import type { ErpConnectionDto } from '@/hooks/useErpConnections';

export function erpConnectionDisplayName(
  connection: Pick<ErpConnectionDto, 'displayName' | 'accountLabel' | 'erpType'>,
): string {
  const label = connection.displayName?.trim();
  if (label) {
    return label;
  }
  const account = connection.accountLabel?.trim();
  if (account) {
    return account;
  }
  return connection.erpType;
}

export function erpConnectionRoleLabel(
  role: ErpConnectionDto['role'],
): string {
  return role === 'PRIMARY' ? 'Birincil ERP' : 'İkincil ERP (okuma)';
}

export function erpConnectionRoleHint(role: ErpConnectionDto['role']): string {
  return role === 'PRIMARY'
    ? 'Fatura ve ERP\'ye yazma işlemleri bu bağlantı üzerinden yapılır.'
    : 'Stok ve ürün okuma için kullanılır; fatura gönderilmez.';
}
