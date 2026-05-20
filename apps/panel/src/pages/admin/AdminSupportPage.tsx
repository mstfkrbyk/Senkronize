import type { ReactElement } from 'react';
import { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  LifeBuoy,
  Send,
  ShieldCheck,
  Timer,
  UserPlus,
} from 'lucide-react';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
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
import type { AdminUsersListResponse } from '@/types/admin';
import type { TicketPriority, TicketStatus } from '@/types/support';

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'OPEN', label: 'Açık' },
  { value: 'IN_PROGRESS', label: 'İşlemde' },
  { value: 'WAITING_CUSTOMER', label: 'Müşteri bekleniyor' },
  { value: 'RESOLVED', label: 'Çözüldü' },
  { value: 'CLOSED', label: 'Kapalı' },
];

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'LOW', label: 'Düşük' },
  { value: 'MEDIUM', label: 'Orta' },
  { value: 'HIGH', label: 'Yüksek' },
  { value: 'URGENT', label: 'Acil' },
];

function slaBadgeClass(hours: number): string {
  if (hours >= 72) return 'bg-red-100 text-red-800';
  if (hours >= 24) return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}

function formatHours(hours: number | null): string {
  if (hours === null) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} dk`;
  return `${hours.toFixed(1)} sa`;
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
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [orgFilter, setOrgFilter] = useState('');
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
        organizationId: orgFilter.trim() || undefined,
      }),
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

  const { data: adminUsers } = useQuery({
    queryKey: ['admin-support-assignees'],
    queryFn: async (): Promise<AdminUsersListResponse> => {
      const { data: res } = await api.get<AdminUsersListResponse>('/admin/users', {
        params: { page: 1, limit: 100, role: 'SUPER_ADMIN' },
      });
      return res;
    },
    enabled: assignOpen,
  });

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
      toast.success(isInternal ? 'İç not eklendi' : 'Yanıt gönderildi');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const internalNoteMutation = useMutation({
    mutationFn: () => addAdminInternalNote(selectedId!, internalNote),
    onSuccess: () => {
      setInternalNote('');
      invalidate();
      toast.success('İç not eklendi');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const statusMutation = useMutation({
    mutationFn: () => updateAdminTicket(selectedId!, { status: newStatus }),
    onSuccess: () => {
      invalidate();
      toast.success('Durum güncellendi');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const assignMutation = useMutation({
    mutationFn: () => assignAdminTicket(selectedId!, assignAdminId),
    onSuccess: () => {
      setAssignOpen(false);
      setAssignAdminId('');
      invalidate();
      toast.success('Talep atandı');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LifeBuoy className="size-5 text-sky-500" aria-hidden />
          Destek yönetimi
        </h2>
        <p className="text-sm text-muted-foreground">
          Tüm organizasyonların destek taleplerini yönetin ve SLA performansını izleyin.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SlaCard
          title="Açık talepler"
          value={String(stats?.totalOpen ?? 0)}
          sub={`${String(stats?.inProgress ?? 0)} işlemde`}
          icon={LifeBuoy}
          tone="text-sky-600"
          loading={statsLoading}
        />
        <SlaCard
          title="Ort. ilk yanıt"
          value={formatHours(sla?.avgFirstResponseHours ?? stats?.avgFirstResponseHours ?? null)}
          sub={`Hedef: ${String(sla?.slaTargets.firstResponseHours ?? 24)} sa`}
          icon={Clock}
          tone="text-amber-600"
          loading={slaLoading || statsLoading}
        />
        <SlaCard
          title="Ort. çözüm süresi"
          value={formatHours(sla?.avgResolutionHours ?? stats?.avgResolutionHours ?? null)}
          sub={`Hedef: ${String(sla?.slaTargets.resolutionHours ?? 72)} sa`}
          icon={Timer}
          tone="text-violet-600"
          loading={slaLoading || statsLoading}
        />
        <SlaCard
          title="SLA uyum oranı"
          value={
            sla
              ? `%${Math.round(sla.firstResponseComplianceRate * 100)}`
              : '—'
          }
          sub={
            sla
              ? `Çözüm: %${Math.round(sla.resolutionComplianceRate * 100)}`
              : undefined
          }
          icon={ShieldCheck}
          tone="text-emerald-600"
          loading={slaLoading}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm durumlar</SelectItem>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Öncelik" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm öncelikler</SelectItem>
            {PRIORITY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="max-w-xs"
          placeholder="Organizasyon ID"
          value={orgFilter}
          onChange={(e) => setOrgFilter(e.target.value)}
        />
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : isError ? (
        <div className="text-sm text-destructive">
          {getApiErrorMessage(error)}
          <Button type="button" variant="outline" className="ml-2" onClick={() => void refetch()}>
            Tekrar dene
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Talep</TableHead>
                <TableHead>Organizasyon</TableHead>
                <TableHead>Atanan</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Öncelik</TableHead>
                <TableHead>SLA</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <span className="block text-xs text-muted-foreground">
                      {t.ticketNumber}
                    </span>
                    <span className="font-medium">{t.subject}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t.userName} · {t.userEmail}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{t.organizationName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.assignedTo ?? 'Atanmadı'}
                  </TableCell>
                  <TableCell>
                    <TicketStatusBadge status={t.status} />
                  </TableCell>
                  <TableCell>
                    <TicketPriorityBadge priority={t.priority} />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={slaBadgeClass(t.slaHours)}
                    >
                      {t.slaDays > 0
                        ? `${String(t.slaDays)} gün`
                        : `${String(t.slaHours)} sa`}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedId(t.id);
                        setNewStatus(t.status);
                      }}
                    >
                      Yönet
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={Boolean(selectedId)} onOpenChange={(o) => !o && setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detail?.ticketNumber ?? 'Talep detayı'}</DialogTitle>
          </DialogHeader>
          {detailLoading || !detail ? (
            <Skeleton className="h-48 w-full" />
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
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
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
                  Durumu kaydet
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAssignOpen(true)}
                >
                  <UserPlus className="mr-2 size-4" aria-hidden />
                  Ata
                </Button>
              </div>

              <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-3">
                {detail.messages.map((msg) => (
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
                        {msg.isInternal ? ' (iç not)' : ''}
                      </span>
                      <time dateTime={msg.createdAt}>
                        {format(new Date(msg.createdAt), 'd MMM HH:mm', {
                          locale: tr,
                        })}
                      </time>
                    </div>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium">Yanıt gönder</p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="internal-note"
                    checked={isInternal}
                    onCheckedChange={(c) => setIsInternal(c === true)}
                  />
                  <Label htmlFor="internal-note" className="text-sm font-normal">
                    İç not olarak gönder (müşteri görmez)
                  </Label>
                </div>
                <Textarea
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={isInternal ? 'İç not…' : 'Yanıtınız…'}
                />
                <Button
                  type="button"
                  disabled={!reply.trim() || replyMutation.isPending}
                  onClick={() => replyMutation.mutate()}
                >
                  <Send className="mr-2 size-4" aria-hidden />
                  Gönder
                </Button>
              </div>

              <div className="space-y-3 border-t pt-4">
                <p className="text-sm font-medium">İç not ekle</p>
                <Textarea
                  rows={2}
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                  placeholder="Ekip içi not…"
                />
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!internalNote.trim() || internalNoteMutation.isPending}
                  onClick={() => internalNoteMutation.mutate()}
                >
                  İç not kaydet
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedId(null)}>
              Kapat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Talep ata</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Destek uzmanı</Label>
            <Select value={assignAdminId} onValueChange={setAssignAdminId}>
              <SelectTrigger>
                <SelectValue placeholder="Kullanıcı seçin" />
              </SelectTrigger>
              <SelectContent>
                {adminUsers?.users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              disabled={!assignAdminId || assignMutation.isPending}
              onClick={() => assignMutation.mutate()}
            >
              Ata
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
