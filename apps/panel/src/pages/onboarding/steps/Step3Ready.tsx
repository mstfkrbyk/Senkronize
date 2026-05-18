import type { ReactElement } from 'react';
import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  organizationName: string;
  isSubmitting: boolean;
  onGoDashboard: () => void;
}

export function Step3Ready({
  organizationName,
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

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-1">
      <Card className="relative border-0 shadow-none">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl">Hazırsınız! 🎉</CardTitle>
          <CardDescription className="text-base">
            {organizationName} için panonuz kullanıma hazır. İlk siparişlerinizi ve senkronizasyon
            durumunu görmek için panele geçin.
          </CardDescription>
        </CardHeader>
        <CardContent className="mx-auto max-w-md space-y-6 text-center">
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={isSubmitting}
            onClick={onGoDashboard}
          >
            {isSubmitting ? 'Kaydediliyor…' : "Dashboard'a git"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
