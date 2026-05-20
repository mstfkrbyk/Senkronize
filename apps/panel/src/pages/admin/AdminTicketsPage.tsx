import type { ReactElement } from 'react';
import { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, Send } from 'lucide-react';
import { toast } from 'sonner';

import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from '@/components/support/ticket-badges';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { getApiErrorMessage } from '@/lib/api';
import {
  addAdminTicketMessage,
  assignAdminTicket,
  fetchAdminTicket,
  fetchAdminTickets,
  updateAdminTicketStatus,
} from '@/lib/support-api';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
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

export function AdminTicketsPage(): ReactElement {
  const queryClient = useQueryClient();
  const adminId = useAuthStore((s) => s.user?.id);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [orgFilter, setOrgFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
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

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['admin-ticket', selectedId],
    queryFn: () => fetchAdminTicket(selectedId!),
    enabled: Boolean(selectedId),
  });

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['admin-tickets'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-ticket', selectedId] });
  };

  const replyMutation = useMutation({
    mutationFn: () =>
      addAdminTicketMessage(selectedId!, reply, isInternal),
    onSuccess: () => {
      setReply('');
      invalidate();
      toast.success(isInternal ? 'İç not eklendi' : 'Yanıt gönderildi');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const statusMutation = useMutation({
    mutationFn: () => updateAdminTicketStatus(selectedId!, newStatus),
    onSuccess: () => {
      invalidate();
      toast.success('Durum güncellendi');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const assignMutation = useMutation({
    mutationFn: () => assignAdminTicket(selectedId!, adminId!),
    onSuccess: () => {
      invalidate();
      toast.success('Talep size atandı');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <LifeBuoy className="size-5 text-sky-500" aria-hidden />
          Destek talepleri
        </h2>
        <p className="text-sm text-muted-foreground">
          Tüm organizasyonların destek taleplerini yönetin.
        </p>
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
            <DialogTitle>
              {detail?.ticketNumber ?? 'Talep detayı'}
            </DialogTitle>
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
                {adminId ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={assignMutation.isPending}
                    onClick={() => assignMutation.mutate()}
                  >
                    Bana ata
                  </Button>
                ) : null}
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
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="internal-note"
                    checked={isInternal}
                    onCheckedChange={(c) => setIsInternal(c === true)}
                  />
                  <Label htmlFor="internal-note" className="text-sm font-normal">
                    İç not (müşteri görmez)
                  </Label>
                </div>
                <Textarea
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={isInternal ? 'İç not…' : 'Yanıtınız…'}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedId(null)}>
              Kapat
            </Button>
            <Button
              type="button"
              disabled={!reply.trim() || replyMutation.isPending}
              onClick={() => replyMutation.mutate()}
            >
              <Send className="mr-2 size-4" aria-hidden />
              Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
