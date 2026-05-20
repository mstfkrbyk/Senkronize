import type { ReactElement } from 'react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
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
import type { AuditLogEntry } from '@/types/audit-log';

export interface LoginHistoryEntry {
  id: string;
  createdAt: string;
  ipAddress: string | null;
  device: string | null;
  deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  success: boolean;
}

const LOGIN_ACTIONS = new Set([
  'USER_LOGIN',
  'auth.login',
  'auth.login_success',
  'auth.login_failed',
]);

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function parseDeviceType(userAgent: string | null): LoginHistoryEntry['deviceType'] {
  if (!userAgent) {
    return 'unknown';
  }
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone/.test(ua)) {
    return 'mobile';
  }
  if (/ipad|tablet/.test(ua)) {
    return 'tablet';
  }
  return 'desktop';
}

function DeviceIcon({
  deviceType,
}: {
  deviceType?: LoginHistoryEntry['deviceType'];
}): ReactElement {
  const className = 'mr-2 inline size-4 shrink-0 text-muted-foreground';
  if (deviceType === 'mobile') {
    return <Smartphone className={className} aria-hidden />;
  }
  if (deviceType === 'tablet') {
    return <Tablet className={className} aria-hidden />;
  }
  return <Monitor className={className} aria-hidden />;
}

export function auditEntriesToLoginHistory(entries: AuditLogEntry[]): LoginHistoryEntry[] {
  return entries
    .filter((e) => LOGIN_ACTIONS.has(e.action) || e.action.startsWith('auth.login'))
    .map((e) => {
      const userAgent =
        metadataString(e.metadata, 'userAgent') ??
        metadataString(e.metadata, 'device') ??
        null;
      return {
        id: e.id,
        createdAt: e.createdAt,
        ipAddress:
          metadataString(e.metadata, 'ipAddress') ??
          metadataString(e.metadata, 'ip') ??
          null,
        device: userAgent,
        deviceType: parseDeviceType(userAgent),
        success: e.action !== 'auth.login_failed',
      };
    });
}

export function sessionsToLoginHistory(
  sessions: {
    id: string;
    createdAt: string;
    ipAddress: string | null;
    device: string | null;
    deviceType?: LoginHistoryEntry['deviceType'];
  }[],
): LoginHistoryEntry[] {
  return sessions.map((s) => ({
    id: `session-${s.id}`,
    createdAt: s.createdAt,
    ipAddress: s.ipAddress,
    device: s.device,
    deviceType: s.deviceType,
    success: true,
  }));
}

export function mergeLoginHistory(
  sessions: LoginHistoryEntry[],
  audit: LoginHistoryEntry[],
  limit = 10,
): LoginHistoryEntry[] {
  const seen = new Set<string>();
  const merged = [...sessions, ...audit]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((entry) => {
      const key = `${entry.createdAt}-${entry.ipAddress ?? ''}-${entry.success}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  return merged.slice(0, limit);
}

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
    <div className="rounded-md border border-border">
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
              <TableCell className="text-sm text-muted-foreground">
                {new Date(row.createdAt).toLocaleString('tr-TR')}
              </TableCell>
              <TableCell className="font-mono text-sm">{row.ipAddress ?? '—'}</TableCell>
              <TableCell className="text-sm">
                <span className="inline-flex items-center">
                  <DeviceIcon deviceType={row.deviceType} />
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
