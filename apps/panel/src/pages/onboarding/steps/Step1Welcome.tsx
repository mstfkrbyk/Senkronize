import type { ReactElement } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  orgName: string;
  onOrgNameChange: (value: string) => void;
  onNext: () => void;
}

export function Step1Welcome({
  orgName,
  onOrgNameChange,
  onNext,
}: Props): ReactElement {
  const canContinue = orgName.trim().length >= 2;

  return (
    <Card className="border-0 shadow-none md:border md:shadow-sm">
      <CardHeader className="space-y-1 px-0 md:px-6">
        <CardTitle className="text-2xl">Hoş geldiniz</CardTitle>
        <CardDescription className="text-base">
          Merhaba! 14 günlük ücretsiz denemeniz başladı.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 px-0 md:px-6">
        <div className="space-y-2">
          <Label htmlFor="onboarding-org-name">Şirket / organizasyon adı</Label>
          <Input
            id="onboarding-org-name"
            value={orgName}
            onChange={(e) => onOrgNameChange(e.target.value)}
            placeholder="Örn. Senkronize Mağazası"
            maxLength={200}
          />
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="mb-3 text-sm font-medium text-foreground">
            Bu süre içinde neler yapabilirsiniz?
          </p>
          <ul className="list-inside list-disc space-y-2 text-sm text-muted-foreground">
            <li>Pazaryeri hesaplarınızı güvenli şekilde bağlayıp sipariş ve stokları tek panelden izleyin.</li>
            <li>ERP veya e-ticaret altyapınızla eşleştirerek veri akışını otomatikleştirin.</li>
            <li>Entegrasyon sağlığını ve raporları gerçek zamanlı olarak takip edin.</li>
          </ul>
        </div>
        <div className="flex justify-end">
          <Button type="button" disabled={!canContinue} onClick={onNext}>
            Başlayalım →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
