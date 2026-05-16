import type { ReactElement } from 'react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function NotificationsTab(): ReactElement {
  const [orderEmail, setOrderEmail] = useState(true);
  const [orderSms, setOrderSms] = useState(false);
  const [stockAlert, setStockAlert] = useState(true);
  const [paymentNote, setPaymentNote] = useState(true);
  const [syncError, setSyncError] = useState(true);

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h3 className="text-lg font-medium text-primary">Bildirim tercihleri</h3>
        <p className="text-sm text-muted-foreground">
          Hangi olaylar için uyarı almak istediğinizi seçin.
        </p>
      </div>

      <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        Tercihler yakında sunucuya kaydedilecek. Şimdilik yalnızca bu oturum için geçerlidir.
      </div>

      <div className="space-y-6">
        <div className="space-y-3 rounded-lg border p-4">
          <p className="font-medium">Yeni sipariş</p>
          <div className="flex items-center justify-between">
            <Label htmlFor="n-order-email">E-posta</Label>
            <Switch
              id="n-order-email"
              checked={orderEmail}
              onCheckedChange={setOrderEmail}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="n-order-sms">SMS</Label>
            <Switch id="n-order-sms" checked={orderSms} onCheckedChange={setOrderSms} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="n-order-push">Push</Label>
            <div className="flex items-center gap-2">
              <Switch id="n-order-push" checked={false} disabled />
              <Badge variant="secondary" className="text-xs">
                Yakında
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <Label htmlFor="n-stock">Stok uyarısı</Label>
          <Switch id="n-stock" checked={stockAlert} onCheckedChange={setStockAlert} />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <Label htmlFor="n-pay">Ödeme bildirimi</Label>
          <Switch id="n-pay" checked={paymentNote} onCheckedChange={setPaymentNote} />
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <Label htmlFor="n-sync">Senkron hatası</Label>
          <Switch id="n-sync" checked={syncError} onCheckedChange={setSyncError} />
        </div>
      </div>
    </div>
  );
}
