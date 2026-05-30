import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  LifeBuoy,
  Plus,
  Search,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import {
  TICKET_CATEGORY_OPTIONS,
  TicketPriorityBadge,
  TicketStatusBadge,
} from '@/components/support/ticket-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/lib/api';
import { fetchHelpArticles } from '@/lib/help-api';
import { formatSupportNavContext } from '@/lib/support-nav-context';
import { fetchSupportTickets } from '@/lib/support-api';
import {
  HELP_CATEGORY_OPTIONS,
  type HelpCategory,
} from '@/types/help';
import type { TicketPriority, TicketStatus } from '@/types/support';

function categoryLabel(value: string | null): string {
  if (!value) return '—';
  return TICKET_CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

function helpCategoryLabel(value: string): string {
  return HELP_CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

interface KpiCardProps {
  title: string;
  value: number;
  icon: typeof LifeBuoy;
  tone: string;
  loading: boolean;
}

function KpiCard({ title, value, icon: Icon, tone, loading }: KpiCardProps): ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`size-5 ${tone}`} aria-hidden />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-2xl font-bold tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function computeKpis(tickets: { status: TicketStatus }[]): {
  open: number;
  waiting: number;
  resolved: number;
} {
  let open = 0;
  let waiting = 0;
  let resolved = 0;

  for (const ticket of tickets) {
    if (ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') {
      open += 1;
    } else if (ticket.status === 'WAITING_CUSTOMER') {
      waiting += 1;
    } else if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
      resolved += 1;
    }
  }

  return { open, waiting, resolved };
}

export function SupportPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navContextLine = formatSupportNavContext(groupLabel, t('nav.support'));
  usePageTitle(t('nav.support'));
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [helpSearch, setHelpSearch] = useState('');
  const [helpCategory, setHelpCategory] = useState<HelpCategory | 'all'>('all');
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, boolean>>({});

  const ticketQueryParams = useMemo(
    () => ({
      status:
        statusFilter === 'all' ? undefined : (statusFilter as TicketStatus),
      priority:
        priorityFilter === 'all' ? undefined : (priorityFilter as TicketPriority),
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [statusFilter, priorityFilter, dateFrom, dateTo],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['support-tickets', ticketQueryParams],
    queryFn: () => fetchSupportTickets(ticketQueryParams),
  });

  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['help-articles', helpCategory, helpSearch],
    queryFn: () =>
      fetchHelpArticles({
        category: helpCategory === 'all' ? undefined : helpCategory,
        search: helpSearch.trim() || undefined,
      }),
  });

  const kpis = useMemo(() => computeKpis(data ?? []), [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('nav.support')}
        description={t('support.subtitle')}
        context={navContextLine}
        actions={
          <Button type="button" onClick={() => navigate('/support/new')}>
            <Plus className="mr-2 size-4" aria-hidden />
            {t('support.newTicket')}
          </Button>
        }
      />

      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets">Ticketlarım</TabsTrigger>
          <TabsTrigger value="help">Yardım Merkezi</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              title="Açık"
              value={kpis.open}
              icon={LifeBuoy}
              tone="text-sky-600"
              loading={isLoading}
            />
            <KpiCard
              title="Bekleyen"
              value={kpis.waiting}
              icon={Clock}
              tone="text-amber-600"
              loading={isLoading}
            />
            <KpiCard
              title="Çözülen"
              value={kpis.resolved}
              icon={CheckCircle2}
              tone="text-emerald-600"
              loading={isLoading}
            />
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="status-filter">Durum</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status-filter" className="w-[200px]">
                  <SelectValue placeholder="Durum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm durumlar</SelectItem>
                  <SelectItem value="OPEN">Açık</SelectItem>
                  <SelectItem value="IN_PROGRESS">İşlemde</SelectItem>
                  <SelectItem value="WAITING_CUSTOMER">Müşteri bekleniyor</SelectItem>
                  <SelectItem value="RESOLVED">Çözüldü</SelectItem>
                  <SelectItem value="CLOSED">Kapalı</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="priority-filter">Öncelik</Label>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger id="priority-filter" className="w-[160px]">
                  <SelectValue placeholder="Öncelik" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm öncelikler</SelectItem>
                  <SelectItem value="LOW">Düşük</SelectItem>
                  <SelectItem value="MEDIUM">Orta</SelectItem>
                  <SelectItem value="HIGH">Yüksek</SelectItem>
                  <SelectItem value="URGENT">Acil</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="date-from">Başlangıç</Label>
              <Input
                id="date-from"
                type="date"
                className="w-[160px]"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="date-to">Bitiş</Label>
              <Input
                id="date-to"
                type="date"
                className="w-[160px]"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p>{getApiErrorMessage(error)}</p>
              <Button type="button" variant="outline" className="mt-2" onClick={() => void refetch()}>
                Tekrar dene
              </Button>
            </div>
          ) : !data?.length ? (
            <EmptyState
              icon={LifeBuoy}
              title={t('support.empty')}
              description="Yeni bir talep oluşturarak destek ekibimizle iletişime geçebilirsiniz."
              action={{
                label: t('support.newTicket'),
                onClick: () => navigate('/support/new'),
              }}
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Konu</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Öncelik</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Son mesaj tarihi</TableHead>
                    <TableHead className="text-right">Aksiyonlar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">
                        <span className="block text-xs text-muted-foreground">
                          {ticket.ticketNumber}
                        </span>
                        {ticket.subject}
                      </TableCell>
                      <TableCell>{categoryLabel(ticket.category)}</TableCell>
                      <TableCell>
                        <TicketPriorityBadge priority={ticket.priority} />
                      </TableCell>
                      <TableCell>
                        <TicketStatusBadge status={ticket.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {ticket.lastMessageAt
                          ? format(new Date(ticket.lastMessageAt), 'd MMM yyyy HH:mm', {
                              locale: tr,
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/support/${ticket.id}`)}
                        >
                          Görüntüle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="help" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HELP_CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.value}
                type="button"
                className={`rounded-lg border bg-card p-4 text-left transition-colors hover:border-sky-300 hover:bg-sky-50/50 ${
                  helpCategory === cat.value ? 'border-sky-400 ring-1 ring-sky-200' : ''
                }`}
                onClick={() =>
                  setHelpCategory((prev) => (prev === cat.value ? 'all' : cat.value))
                }
              >
                <BookOpen className="mb-2 size-5 text-sky-500" aria-hidden />
                <p className="font-medium">{cat.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{cat.description}</p>
              </button>
            ))}
          </div>

          <div className="relative max-w-md">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              className="pl-9"
              placeholder="Makale ara…"
              value={helpSearch}
              onChange={(e) => setHelpSearch(e.target.value)}
            />
          </div>

          {articlesLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : !articles?.length ? (
            <EmptyState
              icon={BookOpen}
              title="Makale bulunamadı"
              description="Arama kriterlerinizi değiştirmeyi deneyin."
            />
          ) : (
            <div className="rounded-lg border bg-card divide-y">
              {articles.map((article) => (
                <div
                  key={article.id}
                  className="flex flex-wrap items-center justify-between gap-4 p-4"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => navigate(`/support/help/${article.slug}`)}
                  >
                    <p className="font-medium hover:text-sky-600">{article.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{helpCategoryLabel(article.category)}</Badge>
                      <span className="inline-flex items-center gap-1">
                        <Eye className="size-3" aria-hidden />
                        {article.views} görüntülenme
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Yardımcı mı?</span>
                    <Button
                      type="button"
                      size="sm"
                      variant={helpfulVotes[article.id] === true ? 'default' : 'outline'}
                      disabled={helpfulVotes[article.id] !== undefined}
                      onClick={() =>
                        setHelpfulVotes((prev) => ({ ...prev, [article.id]: true }))
                      }
                    >
                      <ThumbsUp className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={helpfulVotes[article.id] === false ? 'default' : 'outline'}
                      disabled={helpfulVotes[article.id] !== undefined}
                      onClick={() =>
                        setHelpfulVotes((prev) => ({ ...prev, [article.id]: false }))
                      }
                    >
                      <ThumbsDown className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
