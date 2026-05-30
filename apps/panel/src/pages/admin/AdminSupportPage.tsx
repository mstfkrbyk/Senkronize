import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  LifeBuoy,
  Loader2,
  Send,
  ShieldCheck,
  Timer,
  UserPlus,
} from 'lucide-react';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
import { TableSkeleton } from '@/components/TableSkeleton';
import { toast } from 'sonner';

import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from '@/components/support/ticket-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdminListEmptyState } from '@/pages/admin/AdminListEmptyState';
import { AdminPageHeader } from '@/pages/admin/AdminPageHeader';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  normalizeAdminOrgListResponse,
  normalizeAdminUsersListResponse,
} from '@/lib/admin-api-normalize';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  addAdminInternalNote,
  addAdminTicketMessage,
  assignAdminTicket,
  fetchAdminSupportSla,
  fetchAdminSupportStats,
  fetchAdminTicket,
  fetchAdminTickets,
  updateAdminTicket,
} from '@/lib/support-api';
import { cn } from '@/lib/utils';
import type { AdminOrgListResponse, AdminUsersListResponse } from '@/types/admin';
import type { TicketPriority, TicketStatus } from '@/types/support';

const TICKET_STATUSES: TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
];

const TICKET_PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function slaBadgeClass(hours: number): string {
  if (hours >= 72) return 'bg-red-100 text-red-800';
  if (hours >= 24) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}

function formatHours(
  hours: number | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (hours === null) {
    return t('admin.common.emDash');
  }
  if (hours < 1) {
    return t('admin.support.hoursMinutes', { minutes: Math.round(hours * 60) });
  }
  return t('admin.support.hoursDecimal', { hours: hours.toFixed(1) });
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

interface SlaCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: typeof Timer;
  tone: string;
  loading: boolean;
}

function SlaCard({ title, value, sub, icon: Icon, tone, loading }: SlaCardProps): ReactElement {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`size-5 ${tone}`} aria-hidden />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <>
            <p className="text-2xl font-bold tabular-nums">{value}</p>
            {sub ? <p className="mt-1 text-xs text-muted-foreground">{sub}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminSupportPage(): ReactElement {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [orgFilter, setOrgFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignAdminId, setAssignAdminId] = useState('');
  const [reply, setReply] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [newStatus, setNewStatus] = useState<TicketStatus>('IN_PROGRESS');

  const { data: tickets, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-tickets', statusFilter, priorityFilter, orgFilter],
    queryFn: () =>
      fetchAdminTickets({
        status:
          statusFilter === 'all' ? undefined : (statusFilter as TicketStatus),
        priority:
          priorityFilter === 'all'
            ? undefined
            : (priorityFilter as TicketPriority),
        organizationId: orgFilter === 'all' ? undefined : orgFilter,
      }),
  });

  const { data: orgOptions } = useQuery({
    queryKey: ['admin', 'organizations', 'options'],
    queryFn: async (): Promise<AdminOrgListResponse> => {
      const { data: res } = await api.get<AdminOrgListResponse>(
        '/admin/organizations',
        { params: { page: 1, limit: 100 } },
      );
      return normalizeAdminOrgListResponse(res);
    },
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-support-stats'],
    queryFn: fetchAdminSupportStats,
  });

  const { data: sla, isLoading: slaLoading } = useQuery({
    queryKey: ['admin-support-sla'],
    queryFn: fetchAdminSupportSla,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-ticket', selectedId],
    queryFn: () => fetchAdminTicket(selectedId!),
    enabled: Boolean(selectedId),
  });

  const {
    data: adminUsers,
    isLoading: assigneesLoading,
    isError: assigneesError,
    error: assigneesErrorDetail,
    refetch: refetchAssignees,
  } = useQuery({
    queryKey: ['admin-support-assignees'],
    queryFn: async (): Promise<AdminUsersListResponse> => {
      const { data: res } = await api.get('/admin/users', {
        params: { page: 1, limit: 100, role: 'SUPER_ADMIN' },
      });
      return normalizeAdminUsersListResponse(res);
    },
    enabled: assignOpen,
  });

  const assignableAdmins = useMemo(
    () =>
      (adminUsers?.users ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'tr')),
    [adminUsers?.users],
  );

  const selectedAssignee = assignableAdmins.find((u) => u.id === assignAdminId);

  const closeAssignDialog = (): void => {
    setAssignOpen(false);
    setAssignAdminId('');
  };

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-ticket', selectedId] });
    void queryClient.invalidateQueries({ queryKey: ['admin-support-stats'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-support-sla'] });
  };

  const replyMutation = useMutation({
    mutationFn: () =>
      isInternal
        ? addAdminInternalNote(selectedId!, reply)
        : addAdminTicketMessage(selectedId!, reply, false),
    onSuccess: () => {
      setReply('');
      setIsInternal(false);
      invalidate();
      toast.success(
        isInternal
          ? t('admin.support.toast.internalNoteAdded')
          : t('admin.support.toast.replySent'),
      );
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const internalNoteMutation = useMutation({
    mutationFn: () => addAdminInternalNote(selectedId!, internalNote),
    onSuccess: () => {
      setInternalNote('');
      invalidate();
      toast.success(t('admin.support.toast.internalNoteAdded'));
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const statusMutation = useMutation({
    mutationFn: () => updateAdminTicket(selectedId!, { status: newStatus }),
    onSuccess: () => {
      invalidate();
      toast.success(t('admin.support.toast.statusUpdated'));
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const assignMutation = useMutation({
    mutationFn: () => assignAdminTicket(selectedId!, assignAdminId),
    onSuccess: () => {
      closeAssignDialog();
      invalidate();
      toast.success(t('admin.support.toast.assigned'));
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const hasActiveFilters =
    statusFilter !== 'all' || priorityFilter !== 'all' || orgFilter !== 'all';
  const ticketRows = tickets ?? [];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t('admin.pages.tickets.title')}
        description={t('admin.pages.tickets.description')}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title={t('admin.support.kpi.open')}
          value={stats?.totalOpen ?? 0}
          icon={LifeBuoy}
          tone="text-sky-600"
          loading={statsLoading}
        />
        <KpiCard
          title={t('admin.support.kpi.inProgress')}
          value={stats?.inProgress ?? 0}
          icon={Clock}
          tone="text-amber-600"
          loading={statsLoading}
        />
        <KpiCard
          title={t('admin.support.kpi.waitingCustomer')}
          value={stats?.waitingCustomer ?? 0}
          icon={Timer}
          tone="text-violet-600"
          loading={statsLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SlaCard
          title={t('admin.support.kpi.avgFirstResponse')}
          value={formatHours(sla?.avgFirstResponseHours ?? null, t)}
          sub={t('admin.support.slaTarget', {
            hours: String(sla?.slaTargets?.firstResponseHours ?? 24),
          })}
          icon={Clock}
          tone="text-amber-600"
          loading={slaLoading}
        />
        <SlaCard
          title={t('admin.support.kpi.avgResolution')}
          value={formatHours(sla?.avgResolutionHours ?? null, t)}
          sub={t('admin.support.slaTarget', {
            hours: String(sla?.slaTargets?.resolutionHours ?? 72),
          })}
          icon={Timer}
          tone="text-violet-600"
          loading={slaLoading}
        />
        <SlaCard
          title={t('admin.support.kpi.slaCompliance')}
          value={
            sla
              ? `%${Math.round(sla.firstResponseComplianceRate * 100)}`
              : '—'
          }
          sub={
            sla
              ? t('admin.support.resolutionCompliance', {
                  rate: Math.round(sla.resolutionComplianceRate * 100),
                })
              : undefined
          }
          icon={ShieldCheck}
          tone="text-emerald-600"
          loading={slaLoading}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={t('admin.common.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.support.allStatuses')}</SelectItem>
            {TICKET_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {t(`admin.support.status.${status}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('admin.common.priority')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.support.allPriorities')}</SelectItem>
            {TICKET_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {t(`admin.support.priority.${priority}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t('admin.common.organization')}</Label>
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger className="w-[240px] bg-background">
              <SelectValue placeholder={t('admin.support.orgFilterPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('admin.support.allOrganizations')}</SelectItem>
              {(orgOptions?.orgs ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? <TableSkeleton rows={8} cols={7} /> : null}

      {isError ? (
        <QueryErrorAlert
          error={error}
          onRetry={() => {
            void refetch();
          }}
        />
      ) : null}

      {!isLoading && !isError && ticketRows.length === 0 ? (
        <AdminListEmptyState
          hasActiveFilters={hasActiveFilters}
          emptyTitle={t('admin.support.emptyTitle')}
          emptyDescription={t('admin.support.emptyDescription')}
          icon={LifeBuoy}
        />
      ) : null}

      {!isLoading && !isError && ticketRows.length > 0 ? (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.support.table.ticket')}</TableHead>
                <TableHead>{t('admin.support.table.organization')}</TableHead>
                <TableHead>{t('admin.support.table.assignee')}</TableHead>
                <TableHead>{t('admin.support.table.status')}</TableHead>
                <TableHead>{t('admin.support.table.priority')}</TableHead>
                <TableHead>{t('admin.support.table.sla')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ticketRows.map((ticket) => (
                <TableRow key={ticket.id}>
                  <TableCell>
                    <span className="block text-xs text-muted-foreground">
                      {ticket.ticketNumber}
                    </span>
                    <span className="font-medium">{ticket.subject}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {ticket.userName} · {ticket.userEmail}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{ticket.organizationName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ticket.assignedTo ?? t('admin.support.table.unassigned')}
                  </TableCell>
                  <TableCell>
                    <TicketStatusBadge status={ticket.status} />
                  </TableCell>
                  <TableCell>
                    <TicketPriorityBadge priority={ticket.priority} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={slaBadgeClass(ticket.slaHours)}
                    >
                      {ticket.slaDays > 0
                        ? t('admin.support.table.slaDays', { count: ticket.slaDays })
                        : t('admin.support.table.slaHours', { count: ticket.slaHours })}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedId(ticket.id);
                        setNewStatus(ticket.status);
                      }}
                    >
                      {t('admin.support.table.manage')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedId)} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detail?.ticketNumber ?? t('admin.support.detail.title')}
            </DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <div className="space-y-3 py-4" aria-busy="true">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="font-medium">{detail.subject}</p>
              <div className="flex flex-wrap gap-2">
                <TicketStatusBadge status={detail.status} />
                <TicketPriorityBadge priority={detail.priority} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Select
                  value={newStatus}
                  onValueChange={(v) => setNewStatus(v as TicketStatus)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t(`admin.support.status.${status}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={statusMutation.isPending}
                  onClick={() => statusMutation.mutate()}
                >
                  {t('admin.support.detail.saveStatus')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAssignOpen(true)}
                >
                  <UserPlus className="mr-2 size-4" aria-hidden />
                  {t('admin.support.detail.assign')}
                </Button>
              </div>

              <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
                {(detail.messages ?? []).length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {t('admin.support.detail.noMessages')}
                  </p>
                ) : (
                  (detail.messages ?? []).map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'rounded-md px-2 py-1.5 text-sm',
                        msg.isInternal
                          ? 'border border-dashed border-amber-300 bg-amber-50'
                          : 'bg-muted/50',
                      )}
                    >
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>
                          {msg.userName}
                          {msg.isInternal ? t('admin.support.detail.internalNoteSuffix') : ''}
                        </span>
                        <time dateTime={msg.createdAt}>
                          {format(new Date(msg.createdAt), 'd MMM HH:mm', {
                            locale: tr,
                          })}
                        </time>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium">{t('admin.support.detail.replyHeading')}</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="internal-note"
                    checked={isInternal}
                    onCheckedChange={(c) => setIsInternal(c === true)}
                  />
                  <Label htmlFor="internal-note" className="text-sm font-normal">
                    {t('admin.support.detail.internalCheckbox')}
                  </Label>
                </div>
                <Textarea
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={
                    isInternal
                      ? t('admin.support.detail.internalPlaceholder')
                      : t('admin.support.detail.replyPlaceholder')
                  }
                />
                <Button
                  type="button"
                  disabled={!reply.trim() || replyMutation.isPending}
                  onClick={() => replyMutation.mutate()}
                >
                  <Send className="mr-2 size-4" aria-hidden />
                  {t('admin.support.detail.send')}
                </Button>
              </div>

              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium">{t('admin.support.detail.internalHeading')}</p>
                <Textarea
                  rows={2}
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder={t('admin.support.detail.internalPlaceholder')}
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!internalNote.trim() || internalNoteMutation.isPending}
                  onClick={() => internalNoteMutation.mutate()}
                >
                  {t('admin.support.detail.saveInternal')}
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedId(null)}>
              {t('admin.support.detail.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={assignOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeAssignDialog();
            return;
          }
          setAssignOpen(true);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.support.assignDialog.title')}</DialogTitle>
            <DialogDescription>
              {detail?.ticketNumber
                ? t('admin.support.assignDialog.descriptionWithNumber', {
                    ticketNumber: detail.ticketNumber,
                  })
                : t('admin.support.assignDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1">
              <Label htmlFor="admin-ticket-assignee">
                {t('admin.support.assignDialog.assigneeLabel')}
              </Label>
              {assigneesLoading ? (
                <div
                  className="flex items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-4 text-sm text-muted-foreground"
                  role="status"
                >
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t('admin.support.assignDialog.loadingAssignees')}
                </div>
              ) : assigneesError ? (
                <QueryErrorAlert
                  error={assigneesErrorDetail}
                  onRetry={() => {
                    void refetchAssignees();
                  }}
                />
              ) : assignableAdmins.length === 0 ? (
                <div
                  className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-center"
                  role="status"
                >
                  <ShieldCheck
                    className="size-8 text-muted-foreground"
                    aria-hidden
                  />
                  <p className="text-sm font-medium">
                    {t('admin.support.assignDialog.noAssigneesTitle')}
                  </p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    {t('admin.support.assignDialog.noAssigneesDescription')}
                  </p>
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" asChild>
                    <Link to="/admin/users">{t('admin.support.assignDialog.manageUsers')}</Link>
                  </Button>
                </div>
              ) : (
                <Select
                  value={assignAdminId || undefined}
                  onValueChange={setAssignAdminId}
                >
                  <SelectTrigger id="admin-ticket-assignee">
                    <SelectValue placeholder={t('admin.support.assignDialog.selectPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableAdmins.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} · {user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {selectedAssignee ? (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                <p className="font-medium">{selectedAssignee.name}</p>
                <p className="text-xs text-muted-foreground">{selectedAssignee.email}</p>
                {detail?.assignedTo ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('admin.support.assignDialog.currentAssignment', {
                      name: detail.assignedTo,
                    })}
                  </p>
                ) : null}
              </div>
            ) : assignableAdmins.length > 0 && !assigneesLoading && !assigneesError ? (
              <p className="text-sm text-muted-foreground">
                {t('admin.support.assignDialog.hint')}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeAssignDialog}>
              {t('admin.support.assignDialog.cancel')}
            </Button>
            <Button
              type="button"
              disabled={
                !assignAdminId ||
                assignMutation.isPending ||
                assignableAdmins.length === 0 ||
                assigneesLoading ||
                assigneesError
              }
              onClick={() => assignMutation.mutate()}
            >
              {assignMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
              ) : null}
              {t('admin.support.assignDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
