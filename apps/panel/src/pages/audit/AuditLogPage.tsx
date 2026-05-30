import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AuditLogMetadataCell } from '@/components/audit/AuditLogMetadataCell';
import {
  buildAuditLogActionPresets,
  buildAuditLogProductCategoryOptions,
  filterAuditLogsForDisplay,
  showAuditLogProductCategoryChips,
  type AuditLogProductCategory,
} from '@/lib/audit-log-categories';
import {
  auditLogUserLabel,
  formatAuditLogAction,
  formatAuditLogResourceDisplay,
} from '@/lib/audit-log-labels';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { api, getApiErrorMessage } from '@/lib/api';
import { formatNavPageContext } from '@/lib/nav-page-context';
import { useAuthStore } from '@/store/auth.store';
import type { AuditLogsPageResponse } from '@/types/audit-log';

const PAGE_SIZE = 50;

function boundaryISO(d: Date, end: boolean): string {
  const x = new Date(d);
  if (end) {
    x.setHours(23, 59, 59, 999);
  } else {
    x.setHours(0, 0, 0, 0);
  }
  return x.toISOString();
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AuditLogPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatNavPageContext(groupLabel, t('nav.auditLogs'));
  const orgProducts = useAuthStore((s) => s.currentOrg?.orgProducts);
  const showProductChips = showAuditLogProductCategoryChips(orgProducts);
  const productCategoryOptions = useMemo(
    () => buildAuditLogProductCategoryOptions(orgProducts),
    [orgProducts],
  );
  const actionPresets = useMemo(
    () => buildAuditLogActionPresets(orgProducts),
    [orgProducts],
  );
  usePageTitle('Denetim Günlüğü');

  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState<'7' | '30' | 'custom'>('7');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [action, setAction] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [productCategory, setProductCategory] =
    useState<AuditLogProductCategory>('all');

  useEffect(() => {
    if (!productCategoryOptions.some((o) => o.value === productCategory)) {
      setProductCategory('all');
      setPage(1);
    }
  }, [productCategory, productCategoryOptions]);

  useEffect(() => {
    if (!actionPresets.some((p) => p.value === action)) {
      setAction('');
      setPage(1);
    }
  }, [action, actionPresets]);

  const { from, to } = useMemo(() => {
    if (preset === 'custom') {
      return {
        from:
          customFrom.length > 0
            ? `${customFrom}T00:00:00.000`
            : undefined,
        to:
          customTo.length > 0 ? `${customTo}T23:59:59.999` : undefined,
      };
    }
    const days = preset === '30' ? 30 : 7;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return {
      from: boundaryISO(start, false),
      to: boundaryISO(end, true),
    };
  }, [preset, customFrom, customTo]);

  const query = useQuery({
    queryKey: [
      'audit-logs',
      page,
      preset,
      customFrom,
      customTo,
      from,
      to,
      action,
      userEmail,
    ],
    queryFn: async (): Promise<AuditLogsPageResponse> => {
      const params: Record<string, string | number> = {
        page,
        limit: PAGE_SIZE,
      };
      if (action.length > 0) {
        params.action = action;
      }
      if (from) {
        params.from = from;
      }
      if (to) {
        params.to = to;
      }
      if (userEmail.trim().length > 0) {
        params.userEmail = userEmail.trim();
      }
      const { data } = await api.get<AuditLogsPageResponse>('/audit-logs', {
        params,
      });
      return data;
    },
  });

  const displayedLogs = useMemo(() => {
    if (!query.data?.logs) {
      return [];
    }
    return filterAuditLogsForDisplay(query.data.logs, {
      orgProducts,
      productCategory,
    });
  }, [query.data?.logs, orgProducts, productCategory]);

  const apiTotal = query.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(apiTotal / PAGE_SIZE));
  const pageFiltered = displayedLogs.length < (query.data?.logs.length ?? 0);

  const categoryFilterActions =
    showProductChips || productCategoryOptions.length > 2 ? (
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Aktivite kategorisi"
      >
        {productCategoryOptions.map((o) => (
          <Button
            key={o.value}
            type="button"
            size="sm"
            variant={productCategory === o.value ? 'default' : 'outline'}
            className="rounded-full"
            onClick={() => {
              setProductCategory(o.value);
              setPage(1);
            }}
          >
            {o.label}
          </Button>
        ))}
      </div>
    ) : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.auditLogs')}
        description={subtitle}
        context={navContextLine}
        actions={categoryFilterActions}
      />

      <Card>
        <CardHeader>
          <CardTitle>Filtreler</CardTitle>
          <CardDescription>
            Tarih aralığı, eylem tipi ve kullanıcı e-postasına göre daraltın.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="audit-preset">Tarih aralığı</Label>
            <Select
              value={preset}
              onValueChange={(v) => {
                setPage(1);
                setPreset(v as '7' | '30' | 'custom');
              }}
            >
              <SelectTrigger id="audit-preset">
                <SelectValue placeholder="Aralık" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Son 7 gün</SelectItem>
                <SelectItem value="30">Son 30 gün</SelectItem>
                <SelectItem value="custom">Özel</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {preset === 'custom' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="audit-from">Başlangıç</Label>
                <Input
                  id="audit-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => {
                    setPage(1);
                    setCustomFrom(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audit-to">Bitiş</Label>
                <Input
                  id="audit-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => {
                    setPage(1);
                    setCustomTo(e.target.value);
                  }}
                />
              </div>
            </>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="audit-action">Eylem tipi</Label>
            <Select
              value={action === '' ? '__all__' : action}
              onValueChange={(v) => {
                setPage(1);
                setAction(v === '__all__' ? '' : v);
              }}
            >
              <SelectTrigger id="audit-action">
                <SelectValue placeholder="Eylem" />
              </SelectTrigger>
              <SelectContent>
                {actionPresets.map((p) => (
                  <SelectItem
                    key={p.value || 'all'}
                    value={p.value === '' ? '__all__' : p.value}
                  >
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-2">
            <Label htmlFor="audit-email">Kullanıcı e-postası</Label>
            <Input
              id="audit-email"
              type="search"
              placeholder="ornek@firma.com"
              value={userEmail}
              onChange={(e) => {
                setPage(1);
                setUserEmail(e.target.value);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {query.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : null}

      {query.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(query.error)}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => {
              void query.refetch();
            }}
          >
            Tekrar dene
          </Button>
        </div>
      ) : null}

      {!query.isLoading && !query.isError && query.data ? (
        <Card>
          <CardHeader>
            <CardTitle>Kayıtlar</CardTitle>
            <CardDescription>
              {pageFiltered
                ? `Bu sayfada ${displayedLogs.length} kayıt (kategori filtresi uygulandı)`
                : `Toplam ${apiTotal} kayıt`}
              {' · '}
              Sayfa {page} / {totalPages}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-[700px] w-full sm:min-w-0">
                <div className="rounded-md border">
                  <Table className="min-w-[700px] sm:min-w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tarih</TableHead>
                        <TableHead>Kullanıcı</TableHead>
                        <TableHead>Eylem</TableHead>
                        <TableHead>Kaynak</TableHead>
                        <TableHead>Detay</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedLogs.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="h-24 text-center text-muted-foreground"
                          >
                            Bu filtrelere uygun kayıt yok.
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayedLogs.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {formatDateTime(row.createdAt)}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate font-medium">
                              {auditLogUserLabel(row)}
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatAuditLogAction(row.action)}
                            </TableCell>
                            <TableCell
                              className="max-w-[200px] truncate text-sm text-muted-foreground"
                              title={
                                row.resourceId
                                  ? `${row.resource} · ${row.resourceId}`
                                  : row.resource
                              }
                            >
                              {formatAuditLogResourceDisplay(
                                row.resource,
                                row.resourceId,
                              )}
                            </TableCell>
                            <TableCell>
                              <AuditLogMetadataCell
                                metadata={row.metadata}
                                action={row.action}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center justify-between gap-4 border-t pt-4 sm:flex-row">
              <p className="text-sm text-muted-foreground">
                {pageFiltered
                  ? `Bu sayfada ${displayedLogs.length} kayıt (kategori filtresi uygulandı)`
                  : `Toplam ${apiTotal} kayıt`}
                {' · '}
                Sayfa {page} / {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                  }}
                >
                  Önceki
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => {
                    setPage((p) => Math.min(totalPages, p + 1));
                  }}
                >
                  Sonraki
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
