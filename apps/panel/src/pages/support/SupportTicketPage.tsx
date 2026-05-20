import type { ReactElement } from 'react';
import { useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  TicketPriorityBadge,
  TicketStatusBadge,
} from '@/components/support/ticket-badges';
import { Button } from '@/components/ui/button';
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

export function SupportTicketPage(): ReactElement {
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
    return (
      <p className="p-6 text-sm text-muted-foreground">Geçersiz talep.</p>
    );
  }

  if (isLoading) {
    return <Skeleton className="m-6 h-96 w-full max-w-3xl" />;
  }

  if (isError || !ticket) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{getApiErrorMessage(error)}</p>
        <Button type="button" variant="link" className="mt-2 px-0" asChild>
          <Link to="/support">← Destek listesine dön</Link>
        </Button>
      </div>
    );
  }

  const isClosed = ticket.status === 'CLOSED';

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

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{ticket.ticketNumber}</p>
          <h1 className="text-xl font-semibold">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Oluşturulma:{' '}
            {format(new Date(ticket.createdAt), 'd MMMM yyyy', { locale: tr })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <TicketStatusBadge status={ticket.status} />
          <TicketPriorityBadge priority={ticket.priority} />
          {!isClosed ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={closeMutation.isPending}
              onClick={() => closeMutation.mutate()}
            >
              {t('support.closeTicket')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex max-w-3xl flex-col gap-4 rounded-lg border bg-card p-4">
        {ticket.messages.map((msg) => {
          const isOwn = msg.userId === userId;
          return (
            <div
              key={msg.id}
              className={cn(
                'flex flex-col gap-1 rounded-lg px-3 py-2 text-sm',
                isOwn
                  ? 'ml-8 bg-sky-50 text-sky-950'
                  : 'mr-8 bg-muted/60 text-foreground',
              )}
            >
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{msg.userName}</span>
                <time dateTime={msg.createdAt}>
                  {format(new Date(msg.createdAt), 'd MMM yyyy HH:mm', {
                    locale: tr,
                  })}
                </time>
              </div>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          );
        })}
      </div>

      {!isClosed ? (
        <form
          className="flex max-w-3xl flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!message.trim()) return;
            messageMutation.mutate();
          }}
        >
          <Textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Mesajınızı yazın…"
          />
          <Button
            type="submit"
            className="w-fit"
            disabled={!message.trim() || messageMutation.isPending}
          >
            <Send className="mr-2 size-4" aria-hidden />
            Gönder
          </Button>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">Bu talep kapatılmıştır.</p>
      )}
    </div>
  );
}
