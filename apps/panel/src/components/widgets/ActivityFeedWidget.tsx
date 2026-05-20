import type { ReactElement } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { DashboardActivityItem } from '@/types/dashboard-widgets';

export function ActivityFeedWidget(): ReactElement {
  const query = useQuery({
    queryKey: ['dashboard', 'activity'],
    queryFn: async (): Promise<DashboardActivityItem[]> => {
      const { data } = await api.get<DashboardActivityItem[]>('/dashboard/activity', {
        params: { limit: 10 },
      });
      return data;
    },
    staleTime: 30_000,
  });

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Aktivite akışı</CardTitle>
        <CardDescription>Son işlemler ve senkron kayıtları</CardDescription>
      </CardHeader>
      <CardContent className="max-h-80 overflow-y-auto">
        {query.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : null}
        {!query.isPending && (query.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz aktivite kaydı yok.</p>
        ) : null}
        <ul className="space-y-3">
          {query.data?.map((item) => (
            <li key={item.id} className="border-b pb-2 last:border-0">
              <p className="text-sm">{item.description}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(item.createdAt), {
                  addSuffix: true,
                  locale: tr,
                })}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
