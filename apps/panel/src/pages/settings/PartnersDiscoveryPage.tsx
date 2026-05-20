import type { ReactElement } from 'react';
import { useState } from 'react';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getApiErrorMessage } from '@/lib/api';
import {
  useAvailablePartners,
  useRequestPartnerLink,
} from '@/pages/partner/hooks/usePartnerLink';
import type { PartnerListItem } from '@/types/partner';

export function PartnersDiscoveryPage(): ReactElement {
  const { data, isLoading, isError, error } = useAvailablePartners();
  const requestLink = useRequestPartnerLink();
  const [selected, setSelected] = useState<PartnerListItem | null>(null);
  const [message, setMessage] = useState('');

  const handleSend = (): void => {
    if (!selected) return;
    requestLink.mutate(
      { partnerOrgId: selected.id, message: message.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Talebiniz admin onayına gönderildi');
          setSelected(null);
          setMessage('');
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/settings?tab=partners">
            <ArrowLeft className="mr-1 size-4" aria-hidden />
            Ayarlara dön
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Partnerlerimizi Keşfet</h1>
          <p className="text-sm text-muted-foreground">
            Ajans partnerlerimizden birine bağlantı talebi gönderin. Onay süreci platform
            yöneticisi tarafından yürütülür.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-muted-foreground" aria-label="Yükleniyor" />
        </div>
      ) : null}

      {isError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {getApiErrorMessage(error)}
        </div>
      ) : null}

      {!isLoading && !isError && (data?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">
          Şu anda bağlantı talebi gönderebileceğiniz partner bulunmuyor.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((partner) => (
          <Card key={partner.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{partner.name}</CardTitle>
                {partner.hasPendingRequest ? (
                  <Badge variant="secondary">Onay bekliyor</Badge>
                ) : null}
              </div>
              <CardDescription>@{partner.slug}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">{partner.description}</p>
              <p className="flex items-center gap-1.5 text-muted-foreground">
                <Users className="size-4 shrink-0" aria-hidden />
                {partner.activeClientCount} aktif müşteri
              </p>
            </CardContent>
            <CardFooter>
              <Button
                type="button"
                size="sm"
                disabled={partner.hasPendingRequest || requestLink.isPending}
                onClick={() => {
                  setSelected(partner);
                  setMessage('');
                }}
              >
                Bağlantı İste
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={selected != null} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name} — bağlantı talebi</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="link-message">Notunuz (isteğe bağlı)</Label>
            <Textarea
              id="link-message"
              rows={4}
              maxLength={2000}
              placeholder="Partnera iletmek istediğiniz kısa bir mesaj yazabilirsiniz."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelected(null)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={requestLink.isPending}
              onClick={handleSend}
            >
              Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
