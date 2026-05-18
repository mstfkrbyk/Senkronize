import type { ReactElement } from 'react';
import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api';
import { FORM_MESSAGES } from '@/lib/form-messages';

import { useCreateOnboardingInvite } from './hooks/usePartner';

const inviteSchema = z.object({
  email: z.string().min(1, FORM_MESSAGES.required).email(FORM_MESSAGES.email),
  message: z.string().max(2000).optional().or(z.literal('')),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface Props {
  trigger?: ReactElement;
}

export function InviteClientDialog({ trigger }: Props): ReactElement {
  const [open, setOpen] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const invite = useCreateOnboardingInvite();

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      message: '',
    },
  });

  function onSubmit(values: InviteFormValues): void {
    setLastInviteUrl(null);
    invite.mutate(
      {
        email: values.email,
        message: values.message?.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          const url =
            typeof data.inviteUrl === 'string' ? data.inviteUrl : null;
          setLastInviteUrl(url);
          toast.success('Davet gönderildi.');
          form.reset({ email: '', message: '' });
        },
        onError: (error: unknown) => {
          toast.error(getApiErrorMessage(error));
        },
      },
    );
  }

  async function copyInviteUrl(): Promise<void> {
    if (!lastInviteUrl) {
      return;
    }
    try {
      await navigator.clipboard.writeText(lastInviteUrl);
      toast.success('Bağlantı kopyalandı.');
    } catch {
      toast.error('Panoya kopyalanamadı.');
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setLastInviteUrl(null);
          form.reset({ email: '', message: '' });
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button type="button">Yeni Müşteri Ekle</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Müşteri davet et</DialogTitle>
          <DialogDescription>
            Müşterinize kayıt bağlantısı içeren bir e-posta gönderilir. İsterseniz kısa bir mesaj
            ekleyebilirsiniz.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Müşteri e-postası</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="off"
                      placeholder="musteri@sirket.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Özel mesaj (isteğe bağlı)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Kısa bir not ekleyin…"
                      rows={3}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {lastInviteUrl ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="mb-2 font-medium">Davet bağlantısı</p>
                <p className="mb-2 break-all text-muted-foreground">{lastInviteUrl}</p>
                <Button type="button" variant="secondary" size="sm" onClick={() => void copyInviteUrl()}>
                  Kopyala
                </Button>
              </div>
            ) : null}
            <DialogFooter>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? 'Gönderiliyor…' : 'Davet Gönder'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
