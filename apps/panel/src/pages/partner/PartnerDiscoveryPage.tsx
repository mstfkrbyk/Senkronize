import type { ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ArrowLeft, Handshake, Mail, MapPin, Phone, Star, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { EmptyState } from '@/components/EmptyState';
import { QueryErrorAlert } from '@/components/QueryErrorAlert';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useActiveNav } from '@/hooks/useActiveNav';
import { usePageTitle } from '@/hooks/usePageTitle';
import { getApiErrorMessage } from '@/lib/api';
import {
  formatSettingsNavContext,
  resolveSettingsSubPageTitle,
} from '@/lib/settings-nav-context';
import { partnerLinkStatusBadgeVariant } from '@/lib/partner-link-status';
import type { PartnerLinkStatus } from '@/types/admin';
import {
  useAvailablePartners,
  useClientPartnerLinkRequests,
  useRequestPartnerLink,
} from '@/pages/partner/hooks/usePartnerLink';
import type { ClientPartnerLinkRequest, PartnerListItem } from '@/types/partner';

import {
  getExpertiseFilterOptions,
  matchesExpertise,
  partnerDisplayRating,
} from './partner-utils';

function linkStatusLabel(status: PartnerLinkStatus, t: TFunction): string {
  return t(`partner.linkStatus.${status}`, {
    defaultValue: t('partner.linkStatus.unknown'),
  });
}

function StarRating({
  value,
  label,
}: {
  value: number;
  label: string;
}): ReactElement {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={label}>
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
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { groupLabel } = useActiveNav();
  const settingsLeaf = resolveSettingsSubPageTitle(pathname);
  const navContextLine = formatSettingsNavContext(
    groupLabel,
    t('nav.settings'),
    settingsLeaf,
  );
  usePageTitle(t('partner.pages.discovery.title'));
  const { data, isLoading, isError, error, refetch, isFetching } = useAvailablePartners();
  const { data: myLinkRequests } = useClientPartnerLinkRequests();
  const requestLink = useRequestPartnerLink();
  const [selected, setSelected] = useState<PartnerListItem | null>(null);
  const [message, setMessage] = useState('');
  const [expertise, setExpertise] = useState<string>('all');
  const [location, setLocation] = useState('');

  const partners = useMemo(() => data ?? [], [data]);
  const expertiseFilters = useMemo(() => getExpertiseFilterOptions(t), [t]);

  const linkRequestByPartnerId = useMemo(() => {
    const map = new Map<string, ClientPartnerLinkRequest>();
    for (const row of myLinkRequests ?? []) {
      if (!map.has(row.partnerOrgId)) {
        map.set(row.partnerOrgId, row);
      }
    }
    return map;
  }, [myLinkRequests]);

  const filtered = useMemo(() => {
    const loc = location.trim().toLowerCase();
    return partners.filter((p) => {
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
  }, [partners, expertise, location]);

  const clearFilters = (): void => {
    setExpertise('all');
    setLocation('');
  };

  const handleSend = (): void => {
    if (!selected) {
      return;
    }
    requestLink.mutate(
      { partnerOrgId: selected.id, message: message.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(t('partner.pages.discovery.requestSuccess'));
          setSelected(null);
          setMessage('');
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  };

  const pageHeader = (
    <div className="flex flex-wrap items-center gap-3">
      <Button asChild variant="ghost" size="sm">
        <Link to="/settings?tab=partners">
          <ArrowLeft className="mr-1 size-4" aria-hidden />
          {t('partner.pages.discovery.backToSettings')}
        </Link>
      </Button>
      <div>
        <p className="text-sm text-muted-foreground">{navContextLine}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('partner.pages.discovery.title')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('partner.pages.discovery.subtitle')}
        </p>
      </div>
    </div>
  );

  const filterBar = (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Select value={expertise} onValueChange={setExpertise}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder={t('partner.pages.discovery.expertisePlaceholder')} />
        </SelectTrigger>
        <SelectContent>
          {expertiseFilters.map((f) => (
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
          placeholder={t('partner.pages.discovery.locationPlaceholder')}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        {pageHeader}
        {filterBar}
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          role="status"
          aria-live="polite"
          aria-label={t('partner.pages.discovery.loading')}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        {pageHeader}
        {filterBar}
        <EmptyState
          icon={Handshake}
          title={t('partner.pages.discovery.errorTitle')}
          description={t('partner.pages.discovery.errorDescription')}
          actionSlot={
            <Button
              type="button"
              variant="outline"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              {t('partner.pages.discovery.retry')}
            </Button>
          }
        />
        <QueryErrorAlert error={error} />
      </div>
    );
  }

  const showEmptyList = partners.length === 0;
  const showEmptyFiltered = !showEmptyList && filtered.length === 0;

  return (
    <div className="space-y-6">
      {pageHeader}
      {filterBar}

      {showEmptyList ? (
        <EmptyState
          icon={Handshake}
          title={t('partner.pages.discovery.emptyListTitle')}
          description={t('partner.pages.discovery.emptyListDescription')}
        />
      ) : null}

      {showEmptyFiltered ? (
        <EmptyState
          icon={Handshake}
          title={t('partner.pages.discovery.emptyFilteredTitle')}
          description={t('partner.pages.discovery.emptyFilteredDescription')}
          actionSlot={
            <Button type="button" variant="outline" onClick={clearFilters}>
              {t('partner.pages.discovery.clearFilters')}
            </Button>
          }
        />
      ) : null}

      {!showEmptyList && !showEmptyFiltered ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((partner) => {
            const rating = partnerDisplayRating(partner.id, partner.activeClientCount);
            const linkRequest = linkRequestByPartnerId.get(partner.id);
            const showPendingBadge =
              partner.hasPendingRequest ||
              linkRequest?.status === 'PENDING';
            const showStatusBadge =
              linkRequest != null && linkRequest.status !== 'PENDING';
            const description =
              partner.description.trim().length > 0
                ? partner.description
                : t('partner.pages.discovery.noDescription');
            return (
              <Card key={partner.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{partner.name}</CardTitle>
                    <div className="flex flex-col items-end gap-1">
                      {showPendingBadge ? (
                        <Badge variant="secondary">
                          {t('partner.pages.discovery.pendingBadge')}
                        </Badge>
                      ) : null}
                      {showStatusBadge && linkRequest ? (
                        <Badge variant={partnerLinkStatusBadgeVariant(linkRequest.status)}>
                          {linkStatusLabel(linkRequest.status, t)}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <CardDescription>@{partner.slug}</CardDescription>
                  <StarRating
                    value={rating}
                    label={t('partner.pages.discovery.starRating', { value: rating })}
                  />
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{description}</p>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="size-4 shrink-0" aria-hidden />
                    {t('partner.pages.discovery.clientCount', {
                      count: partner.activeClientCount,
                    })}
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
                    disabled={
                      showPendingBadge ||
                      linkRequest?.status === 'APPROVED' ||
                      requestLink.isPending
                    }
                    onClick={() => {
                      setSelected(partner);
                      setMessage('');
                    }}
                  >
                    {showPendingBadge
                      ? t('partner.pages.discovery.pendingBadge')
                      : linkRequest?.status === 'APPROVED'
                        ? linkStatusLabel('APPROVED', t)
                        : t('partner.pages.discovery.requestCta')}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      ) : null}

      <Dialog open={selected != null} onOpenChange={() => setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('partner.pages.discovery.dialogTitle', { name: selected?.name ?? '' })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="link-message">
              {t('partner.pages.discovery.messageLabel')}
            </Label>
            <Textarea
              id="link-message"
              rows={4}
              maxLength={2000}
              placeholder={t('partner.pages.discovery.messagePlaceholder')}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelected(null)}>
              {t('partner.common.cancel')}
            </Button>
            <Button type="button" disabled={requestLink.isPending} onClick={handleSend}>
              {requestLink.isPending
                ? t('partner.pages.discovery.sending')
                : t('partner.pages.discovery.send')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
