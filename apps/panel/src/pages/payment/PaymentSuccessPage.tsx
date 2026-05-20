import type { ReactElement } from 'react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PaymentSuccessPage(): ReactElement {
  useEffect(() => {
    const duration = 2_500;
    const end = Date.now() + duration;
    const frame = (): void => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#38bdf8', '#0f172a', '#22c55e'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#38bdf8', '#0f172a', '#22c55e'],
      });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg text-center">
        <CardHeader className="items-center space-y-3">
          <CheckCircle2 className="h-14 w-14 text-emerald-600" aria-hidden />
          <CardTitle className="text-2xl">Aboneliğiniz aktif!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Ödemeniz başarıyla alındı. Tüm özelliklere hemen erişebilirsiniz.
          </p>
          <Button asChild>
            <Link to="/settings/subscription">Aboneliğe git</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
