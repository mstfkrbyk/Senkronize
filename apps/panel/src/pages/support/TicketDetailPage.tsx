import type { ReactElement } from 'react';
import { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Circle, Paperclip, Send, XCircle } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

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
import { getApiErrorMessage } from '@/lib/api';
import {
  addSupportTicketMessage,
  closeSupportTicket,
  fetchSupportTicket,
} from '@/lib/support-api';
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
    return <p className="p-6 text-sm text-muted-foreground">Geçersiz talep.</p>;
  }

  if (isLoading) {
    return <Skeleton className="m-6 h-96 w-full" />;
  }

  if (isError || !ticket) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
        <Button type="button" variant="link" className="mt-2 px-0" onClick={() => navigate('/support')}>
          ← Destek listesine dön
        </Button>
      </div>
    );
  }

  const isClosed = ticket.status === 'CLOSED';
  const currentStep = statusIndex(ticket.status);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <Button
        type="button"
        variant="ghost"
        className="w-fit px-0"
        onClick={() => navigate('/support')}
      >
        <ArrowLeft className="mr-2 size-4" aria-hidden />
        {t('support.backToList')}
      </Button>

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

        <div className="flex min-h-[480px] flex-col rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h1 className="text-lg font-semibold">{ticket.subject}</h1>
            <div className="mt-1">
              <TicketStatusBadge status={ticket.status} />
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
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
          </div>

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
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Paperclip className="size-4" aria-hidden />
                  Dosya ekleme yakında
                </div>
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
        </div>
      </div>
    </div>
  );
}
