import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ERP_OPTIONS, MARKETPLACE_OPTIONS } from '@/pages/onboarding/onboarding.options';

interface Props {
  selectedMarketplace: string | null;
  selectedErp: string | null;
  isSubmitting: boolean;
  onGoDashboard: () => void;
}

export function Step4Done({
  selectedMarketplace,
  selectedErp,
  isSubmitting,
  onGoDashboard,
}: Props): ReactElement {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) {
      return;
    }
    fired.current = true;
    void confetti({
      particleCount: 140,
      spread: 72,
      origin: { y: 0.55 },
      colors: ['#38bdf8', '#fbbf24', '#34d399', '#fb7185', '#a78bfa'],
    });
  }, []);

  const mpLabel =
    MARKETPLACE_OPTIONS.find((m) => m.id === selectedMarketplace)?.label ?? '—';
  const erpLabel = selectedErp
    ? (ERP_OPTIONS.find((e) => e.id === selectedErp)?.label ?? '—')
    : 'Atlandı';

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-1">
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
            {isSubmitting ? 'Kaydediliyor…' : 'Panele Git'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
