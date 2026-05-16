import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ERP_OPTIONS, MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';

interface Props {
  selectedMarketplace: string | null;
  selectedErp: string | null;
  isSubmitting: boolean;
  onGoDashboard: () => void;
}

const CONFETTI_PIECE_CLASSES = [
  'absolute top-0 left-[3%] h-2 w-2 animate-confetti rounded-sm bg-sky-400 opacity-90 delay-0',
  'absolute top-0 left-[12%] h-2 w-2 animate-confetti rounded-sm bg-amber-400 opacity-90 delay-75',
  'absolute top-0 left-[22%] h-2 w-2 animate-confetti rounded-sm bg-emerald-400 opacity-90 delay-100',
  'absolute top-0 left-[31%] h-2 w-2 animate-confetti rounded-sm bg-rose-400 opacity-90 delay-150',
  'absolute top-0 left-[40%] h-2 w-2 animate-confetti rounded-sm bg-violet-400 opacity-90 delay-200',
  'absolute top-0 left-[48%] h-2 w-2 animate-confetti rounded-sm bg-sky-400 opacity-90 delay-300',
  'absolute top-0 left-[56%] h-2 w-2 animate-confetti rounded-sm bg-amber-400 opacity-90 delay-75',
  'absolute top-0 left-[64%] h-2 w-2 animate-confetti rounded-sm bg-emerald-400 opacity-90 delay-100',
  'absolute top-0 left-[72%] h-2 w-2 animate-confetti rounded-sm bg-rose-400 opacity-90 delay-150',
  'absolute top-0 left-[80%] h-2 w-2 animate-confetti rounded-sm bg-violet-400 opacity-90 delay-200',
  'absolute top-0 left-[88%] h-2 w-2 animate-confetti rounded-sm bg-sky-400 opacity-90 delay-300',
  'absolute top-0 left-[18%] h-1.5 w-3 animate-confetti rounded-sm bg-amber-300 opacity-90 delay-500',
  'absolute top-0 left-[52%] h-1.5 w-3 animate-confetti rounded-sm bg-emerald-300 opacity-90 delay-500',
  'absolute top-0 left-[92%] h-1.5 w-3 animate-confetti rounded-sm bg-violet-300 opacity-90 delay-700',
] as const;

export function Step4Done({
  selectedMarketplace,
  selectedErp,
  isSubmitting,
  onGoDashboard,
}: Props): ReactElement {
  const mpLabel =
    MARKETPLACE_OPTIONS.find((m) => m.id === selectedMarketplace)?.label ?? '—';
  const erpLabel = selectedErp
    ? (ERP_OPTIONS.find((e) => e.id === selectedErp)?.label ?? '—')
    : 'Atlandı';

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-1">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        {CONFETTI_PIECE_CLASSES.map((cls, i) => (
          <span key={i} className={cls} />
        ))}
      </div>
      <Card className="relative border-0 shadow-none">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl">Kurulum tamamlandı! 🎉</CardTitle>
          <CardDescription className="text-base">
            Artık panonuzu kullanmaya başlayabilirsiniz.
          </CardDescription>
        </CardHeader>
        <CardContent className="mx-auto max-w-md space-y-6 text-center">
          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-left text-sm">
            <p>
              <span className="font-medium text-foreground">Pazaryeri: </span>
              {mpLabel}
            </p>
            <p className="mt-1">
              <span className="font-medium text-foreground">ERP / altyapı: </span>
              {erpLabel}
            </p>
          </div>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={isSubmitting}
            onClick={onGoDashboard}
          >
            {isSubmitting ? 'Kaydediliyor…' : "Dashboard'a Git"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
