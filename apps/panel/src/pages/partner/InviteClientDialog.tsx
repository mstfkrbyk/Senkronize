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
import { Switch } from '@/components/ui/switch';
import { getApiErrorMessage } from '@/lib/api';

import { useInviteClient } from './hooks/usePartner';

const inviteSchema = z.object({
  clientEmail: z.string().email('Geçerli bir e-posta girin.'),
  commissionPct: z.coerce.number().min(0).max(100).optional(),
  canImpersonate: z.boolean(),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface Props {
  trigger?: ReactElement;
}

export function InviteClientDialog({ trigger }: Props): ReactElement {
  const [open, setOpen] = useState(false);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const invite = useInviteClient();

  const form = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      clientEmail: '',
      commissionPct: 10,
      canImpersonate: true,
    },
  });

  function onSubmit(values: InviteFormValues): void {
    setLastInviteUrl(null);
    invite.mutate(
      {
        clientEmail: values.clientEmail,
        commissionPct: values.commissionPct,
        canImpersonate: values.canImpersonate,
      },
      {
        onSuccess: (data) => {
          setLastInviteUrl(data.inviteUrl);
          toast.success('Davet gönderildi.');
          form.reset({
            clientEmail: '',
            commissionPct: 10,
            canImpersonate: true,
          });
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
          form.reset({
            clientEmail: '',
            commissionPct: 10,
            canImpersonate: true,
          });
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? <Button type="button">Yeni Müşteri Ekle</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Müşteri daveti</DialogTitle>
          <DialogDescription>
            Müşterinize e-posta ile davet gönderin veya bağlantıyı paylaşın.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clientEmail"
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
              name="commissionPct"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Komisyon oranı (%)</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={100} step={0.5} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="canImpersonate"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Hesaba erişim izni</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Müşteri adına panele geçiş yapılabilsin
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
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
