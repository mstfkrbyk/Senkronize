import { isAxiosError } from 'axios';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import {
  buildHourlyStatsFromLogs,
  deriveHealthFromConnection,
} from '@/pages/connections/connection-utils';
import {
  normalizeConnectionHealthApiResponse,
  type ConnectionHealthApiResponse,
} from '@/lib/connection-health-mapper';
import { api } from '@/lib/api';
import type { ConnectionHealthDto } from '@/types/connection-health';
import type { MarketplaceConnectionDto } from '@/types/connection';
import type { SyncLogEntry } from '@/types/sync-log';

const HEALTH_REFETCH_MS = 30_000;

async function fetchConnectionHealthLogs(platform: string): Promise<SyncLogEntry[]> {
  const params = new URLSearchParams({
    platform,
    limit: '100',
  });
  const { data } = await api.get<{ data: SyncLogEntry[] }>(
    `/sync/logs?${params.toString()}`,
  );
  return data.data.filter((log) => log.platform === platform);
}

async function fetchHealthFromApi(
  connectionId: string,
): Promise<ConnectionHealthApiResponse | null> {
  try {
    const { data } = await api.get<{ data: ConnectionHealthApiResponse }>(
      `/connections/${connectionId}/health`,
    );
    return data.data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) {
      try {
        const { data } = await api.get<{ data: ConnectionHealthApiResponse }>(
          `/marketplace-connections/${connectionId}/health`,
        );
        return data.data;
      } catch (inner) {
        if (isAxiosError(inner) && inner.response?.status === 404) {
          return null;
        }
        throw inner;
      }
    }
    throw error;
  }
}

async function resolveConnectionPlatform(
  connectionId: string,
  fallbackConnection?: MarketplaceConnectionDto | null,
): Promise<string | null> {
  if (fallbackConnection?.platform) {
    return fallbackConnection.platform;
  }
  try {
    const { data } = await api.get<MarketplaceConnectionDto>(
      `/marketplace-connections/${connectionId}`,
    );
    return data.platform;
  } catch {
    return null;
  }
}

export function useConnectionHealth(
  connectionId: string | null,
  fallbackConnection?: MarketplaceConnectionDto | null,
): UseQueryResult<ConnectionHealthDto, Error> {
  return useQuery({
    queryKey: ['connection-health', connectionId],
    enabled: connectionId !== null,
    refetchInterval: HEALTH_REFETCH_MS,
    queryFn: async (): Promise<ConnectionHealthDto> => {
      if (!connectionId) {
        throw new Error('Bağlantı kimliği gerekli');
      }

      const fromApi = await fetchHealthFromApi(connectionId);
      if (fromApi) {
        const platform = await resolveConnectionPlatform(
          connectionId,
          fallbackConnection,
        );
        const logs = platform
          ? await fetchConnectionHealthLogs(platform)
          : [];
        return normalizeConnectionHealthApiResponse(fromApi, logs);
      }

      let connection = fallbackConnection ?? null;
      if (!connection) {
        const { data } = await api.get<MarketplaceConnectionDto>(
          `/marketplace-connections/${connectionId}`,
        );
        connection = data;
      }

      const logs = await fetchConnectionHealthLogs(connection.platform);
      return deriveHealthFromConnection(connection, logs);
    },
  });
}

export function useConnectionHealthLogs(
  platform: string | null,
): UseQueryResult<SyncLogEntry[], Error> {
  return useQuery({
    queryKey: ['connection-health-logs', platform],
    enabled: platform !== null,
    queryFn: async (): Promise<SyncLogEntry[]> => {
      if (!platform) {
        return [];
      }
      const params = new URLSearchParams({ platform, limit: '100' });
      const { data } = await api.get<{ data: SyncLogEntry[] }>(
        `/sync/logs?${params.toString()}`,
      );
      return data.data;
    },
  });
}

export { buildHourlyStatsFromLogs, HEALTH_REFETCH_MS };
