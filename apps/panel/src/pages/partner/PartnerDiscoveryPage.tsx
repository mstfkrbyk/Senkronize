import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Mail, MapPin, Phone, Star, Users } from 'lucide-react';
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
import {
  useAvailablePartners,
  useRequestPartnerLink,
} from '@/pages/partner/hooks/usePartnerLink';
import type { PartnerListItem } from '@/types/partner';

import {
  EXPERTISE_FILTERS,
  matchesExpertise,
  partnerDisplayRating,
} from './partner-utils';

function StarRating({ value }: { value: number }): ReactElement {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} yıldız`}>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < full || (i === full && half);
        return (
          <Star
            key={i}
            className={`size-4 ${filled ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`}
            aria-hidden
          />
        );
      })}
      <span className="ml-1 text-xs text-muted-foreground">{value.toFixed(1)}</span>
    </span>
  );
}

export function PartnerDiscoveryPage(): ReactElement {
  const { data, isLoading, isError, error } = useAvailablePartners();
  const requestLink = useRequestPartnerLink();
  const [selected, setSelected] = useState<PartnerListItem | null>(null);
  const [message, setMessage] = useState('');
  const [expertise, setExpertise] = useState<string>('all');
  const [location, setLocation] = useState('');

  const filtered = useMemo(() => {
    const loc = location.trim().toLowerCase();
    return (data ?? []).filter((p) => {
      if (!matchesExpertise(p.description, expertise)) {
        return false;
      }
      if (loc) {
        const hay = `${p.name} ${p.description} ${p.slug}`.toLowerCase();
        if (!hay.includes(loc)) {
          return false;
        }
      }
      return true;
    });
  }, [data, expertise, location]);

  const handleSend = (): void => {
    if (!selected) {
      return;
    }
    requestLink.mutate(
      { partnerOrgId: selected.id, message: message.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Bağlantı talebiniz admin onayına gönderildi');
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
          <h1 className="text-2xl font-semibold tracking-tight">Partner Keşfet</h1>
          <p className="text-sm text-muted-foreground">
            Ajans partnerlerimizi inceleyin ve bağlantı talebi gönderin.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Select value={expertise} onValueChange={setExpertise}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Uzmanlık" />
          </SelectTrigger>
          <SelectContent>
            {EXPERTISE_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative min-w-[200px] flex-1">
          <MapPin
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-9"
            placeholder="Konum veya şehir ara…"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
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

      {!isLoading && !isError && filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Filtrelere uygun partner bulunamadı.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((partner) => {
          const rating = partnerDisplayRating(partner.id, partner.activeClientCount);
          return (
            <Card key={partner.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{partner.name}</CardTitle>
                  {partner.hasPendingRequest ? (
                    <Badge variant="secondary">Onay bekleniyor</Badge>
                  ) : null}
                </div>
                <CardDescription>@{partner.slug}</CardDescription>
                <StarRating value={rating} />
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-muted-foreground">{partner.description}</p>
                <p className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="size-4 shrink-0" aria-hidden />
                  {partner.activeClientCount} müşteri
                </p>
                {partner.supportEmail ? (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="size-4 shrink-0" aria-hidden />
                    <a
                      href={`mailto:${partner.supportEmail}`}
                      className="hover:text-foreground hover:underline"
                    >
                      {partner.supportEmail}
                    </a>
                  </p>
                ) : null}
                {partner.supportPhone ? (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="size-4 shrink-0" aria-hidden />
                    {partner.supportPhone}
                  </p>
                ) : null}
              </CardContent>
              <CardFooter>
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  disabled={partner.hasPendingRequest || requestLink.isPending}
                  onClick={() => {
                    setSelected(partner);
                    setMessage('');
                  }}
                >
                  {partner.hasPendingRequest
                    ? 'Onay bekleniyor'
                    : 'Bağlantı talebi gönder'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <Dialog open={selected != null} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name} — bağlantı talebi</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="link-message">Mesajınız (isteğe bağlı)</Label>
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
            <Button type="button" disabled={requestLink.isPending} onClick={handleSend}>
              Gönder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
