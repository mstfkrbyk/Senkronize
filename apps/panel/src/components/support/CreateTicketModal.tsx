import type { ReactElement } from 'react';
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import {
  TICKET_CATEGORY_OPTIONS,
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
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api';
import { createSupportTicket } from '@/lib/support-api';
import type { TicketPriority } from '@/types/support';

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'LOW', label: 'Düşük' },
  { value: 'MEDIUM', label: 'Orta' },
  { value: 'HIGH', label: 'Yüksek' },
  { value: 'URGENT', label: 'Acil' },
];

const MIN_CONTENT_LENGTH = 20;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTicketModal({ open, onOpenChange }: Props): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('GENERAL');
  const [priority, setPriority] = useState<TicketPriority | 'none'>('none');
  const [content, setContent] = useState('');

  const resetForm = (): void => {
    setSubject('');
    setCategory('GENERAL');
    setPriority('none');
    setContent('');
  };

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
      onOpenChange(false);
      resetForm();
      navigate(`/support/${ticket.id}`);
    },
    onError: (e) => toast.error(getApiErrorMessage(e)),
  });

  const contentValid = content.trim().length >= MIN_CONTENT_LENGTH;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) resetForm();
      }}
    >
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
            <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-4 text-sm text-muted-foreground">
              <Paperclip className="size-4 shrink-0" aria-hidden />
              Dosya ekleme yakında kullanılabilir olacak
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button
            type="button"
            disabled={!subject.trim() || !contentValid || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Gönder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
