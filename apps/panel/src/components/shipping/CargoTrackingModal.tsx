import type { ReactElement } from 'react';

import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiErrorMessage } from '@/lib/api';
import { buildCargoTrackingUrl } from '@/lib/cargo-tracking';
import {
  getCargoDisplay,
  SHIPMENT_TIMELINE_STEPS,
  trackingStatusToTimelineIndex,
} from '@/lib/cargo-display';
import type { CargoTrackingResult } from '@/types/shipping';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackingNumber: string;
  cargoProvider?: string | null;
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function CargoTrackingModal({
  open,
  onOpenChange,
  trackingNumber,
  cargoProvider,
}: Props): ReactElement {
  const trimmed = trackingNumber.trim();
  const display = getCargoDisplay(cargoProvider);

  const trackingQuery = useQuery({
    queryKey: ['cargo', 'track', trimmed, cargoProvider ?? ''],
    enabled: open && trimmed.length > 0,
    queryFn: async (): Promise<CargoTrackingResult> => {
      const params = cargoProvider?.trim()
        ? { cargoProvider: cargoProvider.trim() }
        : undefined;
      const { data } = await api.get<CargoTrackingResult>(
        `/cargo/shipments/${encodeURIComponent(trimmed)}`,
        { params },
      );
      return {
        ...data,
        lastUpdate:
          typeof data.lastUpdate === 'string'
            ? data.lastUpdate
            : new Date(data.lastUpdate).toISOString(),
        events: (data.events ?? []).map((e) => ({
          ...e,
          timestamp:
            typeof e.timestamp === 'string'
              ? e.timestamp
              : new Date(e.timestamp).toISOString(),
        })),
      };
    },
    retry: 1,
  });

  const timelineIndex = trackingQuery.data
    ? trackingStatusToTimelineIndex(trackingQuery.data.status)
    : 0;
  const progressPercent = ((timelineIndex + 1) / SHIPMENT_TIMELINE_STEPS.length) * 100;
  const externalUrl = buildCargoTrackingUrl(trimmed, cargoProvider);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden>
              {display.logo}
            </span>
            Kargo takibi
          </DialogTitle>
          <DialogDescription>{display.label}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground">Takip numarası</p>
            <p className="font-mono text-sm font-medium">{trimmed || '—'}</p>
          </div>

          {trackingQuery.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : null}

          {trackingQuery.isError ? (
            <p className="text-sm text-destructive">{getApiErrorMessage(trackingQuery.error)}</p>
          ) : null}

          {trackingQuery.data ? (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Durum</span>
                  <Badge variant="secondary">{trackingQuery.data.status}</Badge>
                </div>
                <Progress value={progressPercent} className="h-2" />
                <div className="flex justify-between gap-1 text-[10px] text-muted-foreground">
                  {SHIPMENT_TIMELINE_STEPS.map((step, i) => (
                    <span
                      key={step.key}
                      className={
                        i <= timelineIndex ? 'font-medium text-foreground' : undefined
                      }
                    >
                      {step.label}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Son güncelleme: {formatDateTime(trackingQuery.data.lastUpdate)}
                {trackingQuery.data.location
                  ? ` · ${trackingQuery.data.location}`
                  : null}
              </p>
            </>
          ) : null}

          {externalUrl ? (
            <Button type="button" variant="outline" className="w-full" asChild>
              <a href={externalUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden />
                Kargo firmasında aç
              </a>
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
