import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  organizationName: string;
  onNext: () => void;
}

export function Step1Welcome({ organizationName, onNext }: Props): ReactElement {
  return (
    <Card className="border-0 shadow-none md:border md:shadow-sm">
      <CardHeader className="space-y-1 px-0 md:px-6">
        <CardTitle className="text-2xl">Hoş geldiniz, {organizationName}</CardTitle>
        <CardDescription className="text-base">
          14 günlük ücretsiz denemeniz aktif. Pazaryeri ve ERP bağlantılarınızı güvenle kurup
          sipariş ve stoklarınızı tek panelden yönetebilirsiniz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-0 md:px-6">
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium text-foreground">Bundan sonra neler yapacaksınız?</p>
          <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
            <li>Pazaryeri hesaplarınızı Bağlantılar bölümünden ekleyerek sipariş ve stokları izleyin.</li>
            <li>ERP veya e-ticaret altyapınızı istediğiniz zaman bağlayarak veri akışını otomatikleştirin.</li>
            <li>Entegrasyon sağlığını ve raporları panonuzdan takip edin.</li>
          </ul>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={onNext}>
            Devam et →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
