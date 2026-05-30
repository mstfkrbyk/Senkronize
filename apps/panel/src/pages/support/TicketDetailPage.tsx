import type { ReactElement } from 'react';
import { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Circle, Send, XCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { TicketFileAttachmentHint } from '@/components/support/TicketFileAttachmentHint';
import {
  TICKET_CATEGORY_OPTIONS,
  TicketPriorityBadge,
  TicketStatusBadge,
} from '@/components/support/ticket-badges';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/lib/api';
import {
  addSupportTicketMessage,
  closeSupportTicket,
  fetchSupportTicket,
} from '@/lib/support-api';
import { formatSupportNavContext } from '@/lib/support-nav-context';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { TicketStatus } from '@/types/support';

const STATUS_STEPS: { status: TicketStatus; label: string }[] = [
  { status: 'OPEN', label: 'Açıldı' },
  { status: 'IN_PROGRESS', label: 'İşlemde' },
  { status: 'WAITING_CUSTOMER', label: 'Yanıt bekleniyor' },
  { status: 'RESOLVED', label: 'Çözüldü' },
  { status: 'CLOSED', label: 'Kapatıldı' },
];

function categoryLabel(value: string | null): string {
  if (!value) return '—';
  return TICKET_CATEGORY_OPTIONS.find((c) => c.value === value)?.label ?? value;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

function statusIndex(status: TicketStatus): number {
  if (status === 'CLOSED') return 4;
  return STATUS_STEPS.findIndex((s) => s.status === status);
}

export function TicketDetailPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);
  const [message, setMessage] = useState('');

  const { data: ticket, isLoading, isError, error } = useQuery({
    queryKey: ['support-ticket', id],
    queryFn: () => fetchSupportTicket(id!),
    enabled: Boolean(id),
  });

  const navContextLine = formatSupportNavContext(
    groupLabel,
    t('nav.support'),
    ticket?.ticketNumber,
  );
  usePageTitle(ticket?.subject ?? t('nav.support'));

  const messageMutation = useMutation({
    mutationFn: () => addSupportTicketMessage(id!, message),
    onSuccess: () => {
      setMessage('');
      void queryClient.invalidateQueries({ queryKey: ['support-ticket', id] });
      void queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Mesaj gönderildi');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const closeMutation = useMutation({
    mutationFn: () => closeSupportTicket(id!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['support-ticket', id] });
      void queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Talep kapatıldı');
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  if (!id) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Geçersiz talep.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !ticket) {
    return (
      <Card>
        <CardContent className="space-y-2 pt-6">
          <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
          <Button type="button" variant="link" className="px-0" onClick={() => navigate('/support')}>
            ← Destek listesine dön
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isClosed = ticket.status === 'CLOSED';
  const currentStep = statusIndex(ticket.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={ticket.subject}
        description={ticket.ticketNumber}
        context={navContextLine}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/support')}>
            <ArrowLeft className="mr-2 size-4" aria-hidden />
            Destek taleplerine dön
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Talep bilgileri</CardTitle>
              <p className="text-xs text-muted-foreground">{ticket.ticketNumber}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Durum</p>
                <div className="mt-2 space-y-2">
                  {STATUS_STEPS.map((step, index) => {
                    const done = index <= currentStep;
                    const active = index === currentStep;
                    return (
                      <div key={step.status} className="flex items-center gap-2 text-sm">
                        {done ? (
                          active && ticket.status !== 'CLOSED' ? (
                            <Circle className="size-4 fill-sky-500 text-sky-500" aria-hidden />
                          ) : (
                            <Check className="size-4 text-emerald-600" aria-hidden />
                          )
                        ) : (
                          <Circle className="size-4 text-muted-foreground/40" aria-hidden />
                        )}
                        <span className={cn(!done && 'text-muted-foreground')}>{step.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground">Öncelik</p>
                <div className="mt-1">
                  <TicketPriorityBadge priority={ticket.priority} />
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground">Kategori</p>
                <p className="mt-1 text-sm">{categoryLabel(ticket.category)}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-muted-foreground">Oluşturma tarihi</p>
                <p className="mt-1 text-sm">
                  {format(new Date(ticket.createdAt), 'd MMMM yyyy HH:mm', { locale: tr })}
                </p>
              </div>

              {!isClosed ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={closeMutation.isPending}
                  onClick={() => closeMutation.mutate()}
                >
                  <XCircle className="mr-2 size-4" aria-hidden />
                  {t('support.closeTicket')}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </aside>

        <Card className="flex min-h-[480px] flex-col">
          <CardHeader className="border-b py-3">
            <TicketStatusBadge status={ticket.status} />
          </CardHeader>

          <CardContent className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
            {ticket.messages
              .filter((msg) => !msg.isInternal)
              .map((msg) => {
                const isOwn = msg.userId === userId;
                return (
                  <div
                    key={msg.id}
                    className={cn('flex gap-3', isOwn ? 'flex-row-reverse' : 'flex-row')}
                  >
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {initials(msg.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={cn(
                        'max-w-[75%] rounded-lg px-3 py-2 text-sm',
                        isOwn
                          ? 'bg-sky-500 text-white'
                          : 'bg-muted text-foreground',
                      )}
                    >
                      <div
                        className={cn(
                          'mb-1 flex items-center justify-between gap-2 text-xs',
                          isOwn ? 'text-sky-100' : 'text-muted-foreground',
                        )}
                      >
                        <span className="font-medium">{msg.userName}</span>
                        <time dateTime={msg.createdAt}>
                          {format(new Date(msg.createdAt), 'd MMM HH:mm', { locale: tr })}
                        </time>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </div>
                );
              })}
          </CardContent>

          {!isClosed ? (
            <form
              className="border-t p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!message.trim()) return;
                messageMutation.mutate();
              }}
            >
              <Textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Mesajınızı yazın…"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <TicketFileAttachmentHint />
                <Button
                  type="submit"
                  disabled={!message.trim() || messageMutation.isPending}
                >
                  <Send className="mr-2 size-4" aria-hidden />
                  Gönder
                </Button>
              </div>
            </form>
          ) : (
            <p className="border-t p-4 text-sm text-muted-foreground">
              Bu talep kapatılmıştır.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
