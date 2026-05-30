import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { TicketFileAttachmentHint } from '@/components/support/TicketFileAttachmentHint';
import { TICKET_CATEGORY_OPTIONS } from '@/components/support/ticket-badges';
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
import { Textarea } from '@/components/ui/textarea';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/lib/api';
import { createSupportTicket } from '@/lib/support-api';
import { formatSupportNavContext } from '@/lib/support-nav-context';
import type { TicketPriority } from '@/types/support';

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'LOW', label: 'Düşük' },
  { value: 'MEDIUM', label: 'Orta' },
  { value: 'HIGH', label: 'Yüksek' },
  { value: 'URGENT', label: 'Acil' },
];

const MIN_CONTENT_LENGTH = 20;

export function SupportTicketPage(): ReactElement {
  const { t } = useTranslation();
  const { groupLabel } = useActiveNav();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const newTicketLabel = t('support.newTicket');

  const navContextLine = formatSupportNavContext(
    groupLabel,
    t('nav.support'),
    newTicketLabel,
  );
  usePageTitle(newTicketLabel);

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [priority, setPriority] = useState<TicketPriority | 'none'>('none');
  const [content, setContent] = useState('');

  const createMutation = useMutation({
    mutationFn: () =>
      createSupportTicket({
        subject,
        content,
        category,
        priority: priority === 'none' ? 'MEDIUM' : priority,
      }),
    onSuccess: (ticket) => {
      void queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Destek talebiniz oluşturuldu');
      navigate(`/support/${ticket.id}`);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const contentValid = content.trim().length >= MIN_CONTENT_LENGTH;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={newTicketLabel}
        description={t('support.subtitle')}
        context={navContextLine}
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/support')}>
            <ArrowLeft className="mr-2 size-4" aria-hidden />
            {t('support.backToList')}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Talep bilgileri</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!subject.trim() || !contentValid || createMutation.isPending) return;
              createMutation.mutate();
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="ticket-subject">Konu</Label>
              <Input
                id="ticket-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Kısa özet"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <Label>Öncelik (isteğe bağlı)</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as TicketPriority | 'none')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Belirtilmedi</SelectItem>
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
                placeholder="Sorununuzu detaylı anlatın (en az 20 karakter)"
              />
              <p className="text-xs text-muted-foreground">
                {content.trim().length}/{MIN_CONTENT_LENGTH} karakter
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Dosya ekleme</Label>
              <TicketFileAttachmentHint variant="boxed" />
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate('/support')}>
                İptal
              </Button>
              <Button
                type="submit"
                disabled={!subject.trim() || !contentValid || createMutation.isPending}
              >
                Gönder
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
