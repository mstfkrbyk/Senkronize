import type { ReactElement } from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronUp, Coins } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { api, getApiErrorMessage } from '@/lib/api';

export function CurrencyWidget(): ReactElement {
  const [open, setOpen] = useState(false);

  const ratesQuery = useQuery({
    queryKey: ['currency', 'rates'],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data } = await api.get<Record<string, number>>('/currency/rates');
      return data ?? {};
    },
    staleTime: 60_000,
    refetchInterval: 300_000,
  });

  const rates = ratesQuery.data ?? {};
  const usd = rates.USD;
  const eur = rates.EUR;
  const gbp = rates.GBP;

  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-30 flex flex-col items-end gap-2 md:bottom-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-2 text-xs shadow-md backdrop-blur-sm">
          <Coins className="h-4 w-4 text-sky-500" aria-hidden />
          <div className="flex flex-col gap-0.5 text-muted-foreground">
            {ratesQuery.isLoading ? (
              <span className="text-foreground">Kurlar yükleniyor…</span>
            ) : ratesQuery.isError ? (
              <span className="text-destructive">{getApiErrorMessage(ratesQuery.error)}</span>
            ) : (
              <>
                <span className="text-foreground">
                  USD{' '}
                  <span className="font-medium tabular-nums text-sky-600">
                    {usd != null ? usd.toFixed(4) : '—'}
                  </span>
                </span>
                <span className="text-foreground">
                  EUR{' '}
                  <span className="font-medium tabular-nums text-sky-600">
                    {eur != null ? eur.toFixed(4) : '—'}
                  </span>
                </span>
                <span className="text-foreground">
                  GBP{' '}
                  <span className="font-medium tabular-nums text-sky-600">
                    {gbp != null ? gbp.toFixed(4) : '—'}
                  </span>
                </span>
              </>
            )}
          </div>
          <DialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <ChevronUp className="h-4 w-4" />
              <span className="sr-only">Tüm kurları göster</span>
            </Button>
          </DialogTrigger>
        </div>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Döviz kurları (TCMB, 1 birim = TRY)</DialogTitle>
          </DialogHeader>
          {ratesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          ) : ratesQuery.isError ? (
            <p className="text-sm text-destructive">{getApiErrorMessage(ratesQuery.error)}</p>
          ) : Object.keys(rates).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz kur kaydı yok. Sistem görevi TCMB verisini çekene kadar bekleyin veya yöneticiye
              başvurun.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {Object.entries(rates)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([code, value]) => (
                  <li
                    key={code}
                    className="flex justify-between border-b border-border py-1 last:border-0"
                  >
                    <span className="font-medium">{code}</span>
                    <span className="tabular-nums text-muted-foreground">{value.toFixed(6)}</span>
                  </li>
                ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
