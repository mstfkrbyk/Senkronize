import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { formatIpAddress } from '@/lib/format-ip-address';

import { LoginHistoryDeviceIcon } from './login-history-device-icon';
import type { LoginHistoryEntry } from './login-history.util';

interface Props {
  entries: LoginHistoryEntry[];
}

export function LoginHistoryTable({ entries }: Props): ReactElement {
  const { t } = useTranslation();

  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        {t('settings.security.loginHistoryEmpty')}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('settings.security.loginHistoryDate')}</TableHead>
            <TableHead>{t('settings.security.loginHistoryIp')}</TableHead>
            <TableHead>{t('settings.security.loginHistoryDevice')}</TableHead>
            <TableHead>{t('settings.security.loginHistoryResult')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {new Date(row.createdAt).toLocaleString('tr-TR')}
              </TableCell>
              <TableCell className="text-sm">{formatIpAddress(row.ipAddress)}</TableCell>
              <TableCell className="min-w-[8rem] text-sm">
                <span className="inline-flex items-center">
                  <LoginHistoryDeviceIcon deviceType={row.deviceType} />
                  {row.device ?? '—'}
                </span>
              </TableCell>
              <TableCell>
                {row.success ? (
                  <Badge variant="default">{t('settings.security.loginSuccess')}</Badge>
                ) : (
                  <Badge variant="destructive">{t('settings.security.loginFailed')}</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
