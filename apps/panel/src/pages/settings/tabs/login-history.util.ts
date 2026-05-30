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
