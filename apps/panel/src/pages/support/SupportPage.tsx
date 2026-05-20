import type { ReactElement } from 'react';
import { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LifeBuoy, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  TICKET_CATEGORY_OPTIONS,
  TicketPriorityBadge,
  TicketStatusBadge,
} from '@/components/support/ticket-badges';
import { Button } from '@/components/ui/button';
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
import { createSupportTicket, fetchSupportTickets } from '@/lib/support-api';
import type { TicketPriority, TicketStatus } from '@/types/support';

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'LOW', label: 'Düşük' },
  { value: 'MEDIUM', label: 'Orta' },
  { value: 'HIGH', label: 'Yüksek' },
  { value: 'URGENT', label: 'Acil' },
];

function categoryLabel(value: string | null): string {
  if (!value) return '—';
  return TICKET_CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

export function SupportPage(): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('genel');
  const [priority, setPriority] = useState<TicketPriority>('MEDIUM');
  const [content, setContent] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['support-tickets', statusFilter],
    queryFn: () =>
      fetchSupportTickets(
        statusFilter === 'all'
          ? undefined
          : { status: statusFilter as TicketStatus },
      ),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createSupportTicket({ subject, content, category, priority }),
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Destek talebiniz oluşturuldu');
      setCreateOpen(false);
      setSubject('');
      setContent('');
      setCategory('genel');
      setPriority('MEDIUM');
      navigate(`/support/${ticket.id}`);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <LifeBuoy className="size-7 text-sky-500" aria-hidden />
            {t('support.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('support.subtitle')}
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 size-4" aria-hidden />
          {t('support.newTicket')}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="status-filter" className="sr-only">
          Durum filtresi
        </Label>
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
        <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          {t('support.empty')}
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Konu</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Öncelik</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Son mesaj</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((ticket) => (
                <TableRow
                  key={ticket.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/support/${ticket.id}`)}
                >
                  <TableCell className="font-medium">
                    <span className="block text-xs text-muted-foreground">
                      {ticket.ticketNumber}
                    </span>
                    {ticket.subject}
                  </TableCell>
                  <TableCell>{categoryLabel(ticket.category)}</TableCell>
                  <TableCell>
                    <TicketStatusBadge status={ticket.status} />
                  </TableCell>
                  <TableCell>
                    <TicketPriorityBadge priority={ticket.priority} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {format(new Date(ticket.createdAt), 'd MMM yyyy', { locale: tr })}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                    {ticket.lastMessage ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Yeni Destek Talebi</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="ticket-subject">Konu</Label>
              <Input
                id="ticket-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Kısa özet"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Kategori</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Öncelik</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as TicketPriority)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ticket-content">Açıklama</Label>
              <Textarea
                id="ticket-content"
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Sorununuzu detaylı anlatın"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              disabled={
                !subject.trim() ||
                !content.trim() ||
                createMutation.isPending
              }
              onClick={() => createMutation.mutate()}
            >
              Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
