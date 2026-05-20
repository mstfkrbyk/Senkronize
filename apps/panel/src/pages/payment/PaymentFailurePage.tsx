import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PaymentFailurePage(): ReactElement {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg text-center">
        <CardHeader className="items-center space-y-3">
          <AlertCircle className="h-14 w-14 text-destructive" aria-hidden />
          <CardTitle className="text-2xl">Ödeme tamamlanamadı</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            İşlem sırasında bir sorun oluştu veya ödeme iptal edildi. Kart bilgilerinizi
            kontrol ederek tekrar deneyebilirsiniz.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link to="/settings/subscription">Tekrar dene</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/dashboard">Panele dön</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
