import type { ReactElement } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AuditLogEntry } from '@/types/audit-log';

const ACTION_LABELS: Record<string, string> = {
  USER_REGISTERED: 'Kullanıcı Kaydı',
  USER_LOGIN: 'Giriş',
  USER_LOGOUT: 'Çıkış',
  IMPERSONATION_START: 'Hesap Erişimi Başladı',
  IMPERSONATION_END: 'Hesap Erişimi Bitti',
  SUBSCRIPTION_ACTIVATED: 'Abonelik Aktifleşti',
  PLAN_CHANGED: 'Plan Değiştirildi',
  'partner.impersonation_start': 'Hesap Erişimi Başladı',
  'partner.impersonation_end': 'Hesap Erişimi Bitti',
  'subscription.plan_activated': 'Abonelik Aktifleşti',
  'subscription.plan_changed': 'Abonelik Planı Değişti',
  'subscription.cancel_requested': 'Abonelik İptal Talebi',
  'subscription.reactivated': 'Abonelik Yeniden Aktifleşti',
  'subscription.payment_failed': 'Ödeme Başarısız',
  'auth.password_changed': 'Şifre değiştirildi',
  'auth.two_factor_enabled': '2FA etkinleştirildi',
  'auth.two_factor_disabled': '2FA devre dışı',
  'auth.two_factor_backup_regenerated': '2FA yedek kodları yenilendi',
  'security.suspect_bulk_night': 'Şüpheli toplu işlem (gece)',
};

interface Props {
  entries: AuditLogEntry[];
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function userLabel(entry: AuditLogEntry): string {
  if (entry.userName?.trim()) {
    return entry.userName.trim();
  }
  if (entry.userEmail?.trim()) {
    return entry.userEmail.trim();
  }
  return entry.userId;
}

export function AuditLogTable({ entries }: Props): ReactElement {
  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        Henüz denetim kaydı yok.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>İşlem</TableHead>
            <TableHead>Kaynak</TableHead>
            <TableHead>Kullanıcı</TableHead>
            <TableHead className="text-right">Tarih</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{actionLabel(row.action)}</TableCell>
              <TableCell className="text-muted-foreground">
                {row.resource}
                {row.resourceId ? (
                  <span className="block truncate text-xs" title={row.resourceId}>
                    {row.resourceId}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="max-w-[140px] truncate text-sm">
                {userLabel(row)}
              </TableCell>
              <TableCell className="text-right text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(row.createdAt), {
                  addSuffix: true,
                  locale: tr,
                })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
