import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Plug } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  onNext: () => void;
}

export function Step2Connections({ onNext }: Props): ReactElement {
  return (
    <Card className="border-0 shadow-none md:border md:shadow-sm">
      <CardHeader className="space-y-1 px-0 md:px-6">
        <CardTitle className="text-2xl">Pazaryeri bağlantıları</CardTitle>
        <CardDescription className="text-base">
          API anahtarlarınızı kayıt sırasında istemiyoruz. Bağlantılarınızı istediğiniz zaman
          güvenli şekilde Entegrasyonlar veya Ayarlar bölümünden ekleyebilirsiniz.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0 md:px-6">
        <p className="text-sm text-muted-foreground">
          Pazaryeri ve ERP bağlantıları için hazır olduğunuzda menüden{' '}
          <span className="font-medium text-foreground">Entegrasyonlar</span> sayfasına gidin.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="default" asChild>
            <Link to="/connections" className="gap-2">
              <Plug className="h-4 w-4" aria-hidden />
              Entegrasyonlara git
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link to="/settings">Ayarlara git</Link>
          </Button>
          <Button type="button" variant="ghost" className="sm:ml-auto" onClick={onNext}>
            Şimdilik atla
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
