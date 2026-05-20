import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';

export function WebhooksTab(): ReactElement {
  return (
    <div className="space-y-4 rounded-lg border border-border p-6">
      <div>
        <h2 className="text-lg font-semibold">Giden webhook&apos;lar</h2>
        <p className="text-sm text-muted-foreground">
          Sipariş, stok, fiyat ve sistem olaylarını kendi HTTPS uç noktanıza iletin. Endpoint
          oluşturma, teslimat logları ve test gönderimi webhook yönetim sayfasından yapılır.
        </p>
      </div>
      <Button type="button" asChild>
        <Link to="/settings/webhooks">Webhook yönetimine git</Link>
      </Button>
    </div>
  );
}
