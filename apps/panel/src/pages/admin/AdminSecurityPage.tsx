import type { ReactElement } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api';
import { AdminPageHeader } from '@/pages/admin/AdminPageHeader';
import type {
  AdminBlockedIpsResponse,
  AdminRateLimitStats,
} from '@/types/admin';

export function AdminSecurityPage(): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const emDash = t('admin.common.emDash');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newIp, setNewIp] = useState('');
  const [removingIp, setRemovingIp] = useState<string | null>(null);

  const blockedIpsQuery = useQuery({
    queryKey: ['admin', 'blocked-ips'],
    queryFn: async (): Promise<string[]> => {
      const { data } = await api.get<AdminBlockedIpsResponse>('/admin/blocked-ips');
      return data.ips ?? [];
    },
  });

  const rateLimitQuery = useQuery({
    queryKey: ['admin', 'rate-limit-stats'],
    queryFn: async (): Promise<AdminRateLimitStats> => {
      const { data } = await api.get<AdminRateLimitStats>('/admin/rate-limit-stats');
      return data;
    },
  });

  const blockIpMutation = useMutation({
    mutationFn: async (ip: string): Promise<void> => {
      await api.post('/admin/blocked-ips', { ip: ip.trim(), blocked: true });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'blocked-ips'] });
      toast.success(t('admin.pages.security.blockedIps.toast.blocked'));
      setAddDialogOpen(false);
      setNewIp('');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
    },
  });

  const unblockIpMutation = useMutation({
    mutationFn: async (ip: string): Promise<void> => {
      await api.delete(`/admin/blocked-ips/${encodeURIComponent(ip)}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'blocked-ips'] });
      toast.success(t('admin.pages.security.blockedIps.toast.unblocked'));
      setRemovingIp(null);
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error));
      setRemovingIp(null);
    },
  });

  const header = (
    <AdminPageHeader
      title={t('admin.pages.security.title')}
      description={t('admin.pages.security.description')}
      showBreadcrumbParent
    />
  );

  const refreshLabel = t('admin.common.refresh');

  return (
    <div className="space-y-6">
      {header}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t('admin.pages.security.blockedIps.title')}</CardTitle>
          </div>
          <Button type="button" onClick={() => setAddDialogOpen(true)}>
            {t('admin.pages.security.blockedIps.addButton')}
          </Button>
        </CardHeader>
        <CardContent>
          {blockedIpsQuery.isLoading ? (
            <TableSkeleton rows={4} cols={3} />
          ) : null}
          {blockedIpsQuery.isError ? (
            <QueryErrorAlert
              error={blockedIpsQuery.error}
              onRetry={() => {
                void blockedIpsQuery.refetch();
              }}
            />
          ) : null}
          {!blockedIpsQuery.isLoading && !blockedIpsQuery.isError ? (
            (blockedIpsQuery.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('admin.pages.security.blockedIps.empty')}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.pages.security.blockedIps.table.ip')}</TableHead>
                    <TableHead>
                      {t('admin.pages.security.blockedIps.table.blockedAt')}
                    </TableHead>
                    <TableHead className="w-[120px] text-right">
                      <span className="sr-only">{t('admin.pages.security.blockedIps.removeButton')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(blockedIpsQuery.data ?? []).map((ip) => (
                    <TableRow key={ip}>
                      <TableCell className="font-mono text-sm">{ip}</TableCell>
                      <TableCell className="text-muted-foreground">{emDash}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={removingIp === ip || unblockIpMutation.isPending}
                          onClick={() => {
                            setRemovingIp(ip);
                            unblockIpMutation.mutate(ip);
                          }}
                        >
                          {removingIp === ip ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            t('admin.pages.security.blockedIps.removeButton')
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>{t('admin.pages.security.rateLimit.title')}</CardTitle>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={rateLimitQuery.isFetching}
            onClick={() => {
              void rateLimitQuery.refetch();
            }}
          >
            {rateLimitQuery.isFetching ? (
              <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="mr-2 size-4" aria-hidden />
            )}
            {refreshLabel}
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {rateLimitQuery.isLoading ? (
            <TableSkeleton rows={5} cols={2} />
          ) : null}
          {rateLimitQuery.isError ? (
            <QueryErrorAlert
              error={rateLimitQuery.error}
              onRetry={() => {
                void rateLimitQuery.refetch();
              }}
            />
          ) : null}
          {!rateLimitQuery.isLoading && !rateLimitQuery.isError && rateLimitQuery.data ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t('admin.pages.security.rateLimit.violationsToday')}:{' '}
                <span className="font-semibold text-foreground">
                  {rateLimitQuery.data.violationsToday}
                </span>
              </p>
              <div>
                <h3 className="mb-2 text-sm font-medium">
                  {t('admin.pages.security.rateLimit.requestsTitle')}
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {t('admin.pages.security.rateLimit.table.platform')}
                      </TableHead>
                      <TableHead className="text-right">
                        {t('admin.pages.security.rateLimit.table.requests')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rateLimitQuery.data.platformDailyRequests.map((row) => (
                      <TableRow key={`${row.platform}-${row.date}`}>
                        <TableCell>{row.platform}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.requestCount}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium">
                  {t('admin.pages.security.rateLimit.violationsTitle')}
                </h3>
                {(rateLimitQuery.data.topViolatingPlatforms.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('admin.common.noRecordsYet')}</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          {t('admin.pages.security.rateLimit.table.source')}
                        </TableHead>
                        <TableHead className="text-right">
                          {t('admin.pages.security.rateLimit.table.throttleCount')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rateLimitQuery.data.topViolatingPlatforms.map((row) => (
                        <TableRow key={row.platform}>
                          <TableCell className="font-mono text-sm">{row.platform}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.pages.security.blockedIps.addDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="admin-block-ip">{t('admin.pages.security.blockedIps.addDialog.label')}</Label>
            <Input
              id="admin-block-ip"
              value={newIp}
              onChange={(e) => setNewIp(e.target.value)}
              placeholder="203.0.113.42"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAddDialogOpen(false);
                setNewIp('');
              }}
            >
              {t('admin.common.cancel')}
            </Button>
            <Button
              type="button"
              disabled={!newIp.trim() || blockIpMutation.isPending}
              onClick={() => {
                blockIpMutation.mutate(newIp.trim());
              }}
            >
              {blockIpMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              {t('admin.pages.security.blockedIps.addDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
