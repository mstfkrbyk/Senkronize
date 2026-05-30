import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api, getApiErrorMessage } from '@/lib/api';
import type { PlatformActivityEntry } from '@/types/admin';

interface Props {
  platformKey: string;
}

function levelBadgeVariant(
  level: PlatformActivityEntry['level'],
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (level === 'ERROR') {
    return 'destructive';
  }
  if (level === 'WARN') {
    return 'outline';
  }
  return 'secondary';
}

export function AdminPlatformActivityLog({ platformKey }: Props): ReactElement {
  const activityQuery = useQuery({
    queryKey: ['admin', 'integrations', platformKey, 'activity'],
    queryFn: async (): Promise<PlatformActivityEntry[]> => {
      const { data } = await api.get<{ data: PlatformActivityEntry[] }>(
        `/admin/integrations/${encodeURIComponent(platformKey)}/activity?limit=120`,
      );
      return Array.isArray(data.data) ? data.data : [];
    },
    refetchInterval: 15_000,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Platform API günlüğü</CardTitle>
          <CardDescription>
            Terminal çıktısı değil; BizimHesap API istekleri, 429 limitleri ve senkron
            engellerinin yapılandırılmış kaydı. 15 sn&apos;de bir yenilenir.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={activityQuery.isFetching}
          onClick={() => {
            void activityQuery.refetch();
          }}
        >
          {activityQuery.isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          )}
          Yenile
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {activityQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Günlük yükleniyor…
          </div>
        ) : null}
        {activityQuery.isError ? (
          <QueryErrorAlert
            error={activityQuery.error}
            onRetry={() => {
              void activityQuery.refetch();
            }}
          />
        ) : null}
        {!activityQuery.isLoading && (activityQuery.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz kayıt yok.</p>
        ) : null}
        {activityQuery.data && activityQuery.data.length > 0 ? (
          <ul className="max-h-[420px] space-y-2 overflow-y-auto rounded-lg border bg-muted/20 p-2 font-mono text-xs">
            {activityQuery.data.map((entry) => (
              <li
                key={entry.id}
                className="rounded-md border bg-background px-3 py-2 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground tabular-nums">
                    {format(new Date(entry.at), 'd MMM HH:mm:ss', { locale: tr })}
                  </span>
                  <Badge variant={levelBadgeVariant(entry.level)}>{entry.level}</Badge>
                  <span className="text-muted-foreground">{entry.action}</span>
                  {entry.organizationId ? (
                    <span className="truncate text-muted-foreground">
                      org:{entry.organizationId.slice(0, 10)}…
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 break-words text-foreground">{entry.message}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function AdminBizimHesapRateLimitTools({
  platformKey,
}: {
  platformKey: string;
}): ReactElement {
  const queryClient = useQueryClient();
  const [organizationId, setOrganizationId] = useState('');

  const clearMutation = useMutation({
    mutationFn: async (): Promise<void> => {
      await api.post(
        `/admin/integrations/${encodeURIComponent(platformKey)}/clear-rate-limit?organizationId=${encodeURIComponent(organizationId.trim())}`,
      );
    },
    onSuccess: () => {
      toast.success('BizimHesap bekleme süresi temizlendi.');
      void queryClient.invalidateQueries({
        queryKey: ['admin', 'integrations', platformKey, 'activity'],
      });
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rate limit yönetimi</CardTitle>
        <CardDescription>
          429 sonrası sistem otomatik bekleme süresi uygular. Acil müdahale için org
          bazlı kilidi kaldırabilirsiniz (dikkatli kullanın).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="grid min-w-[240px] gap-2">
          <Label htmlFor="bh-org-id">Organizasyon ID</Label>
          <Input
            id="bh-org-id"
            value={organizationId}
            onChange={(e) => {
              setOrganizationId(e.target.value);
            }}
            placeholder="cmp…"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!organizationId.trim() || clearMutation.isPending}
          onClick={() => {
            clearMutation.mutate();
          }}
        >
          Bekleme süresini sıfırla
        </Button>
      </CardContent>
    </Card>
  );
}
