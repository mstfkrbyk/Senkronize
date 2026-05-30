import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getApiErrorMessage } from '@/lib/api';

interface Props {
  pushStock: boolean;
  pushPrice: boolean;
  disabled?: boolean;
  onSave: (values: { pushStock: boolean; pushPrice: boolean }) => Promise<void>;
}

export function ConnectionPushSettingsCard({
  pushStock,
  pushPrice,
  disabled,
  onSave,
}: Props): ReactElement {
  const { t } = useTranslation();

  const saveToggle = (
    key: 'pushStock' | 'pushPrice',
    next: boolean,
  ): void => {
    void onSave({
      pushStock: key === 'pushStock' ? next : pushStock,
      pushPrice: key === 'pushPrice' ? next : pushPrice,
    }).then(
      () => {
        toast.success(t('connections.pushSettings.saved'));
      },
      (error) => {
        toast.error(getApiErrorMessage(error));
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('connections.pushSettings.title')}</CardTitle>
        <CardDescription>{t('connections.pushSettings.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="connection-push-stock">{t('connections.pushSettings.stock')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('connections.pushSettings.stockHint')}
            </p>
          </div>
          <Switch
            id="connection-push-stock"
            checked={pushStock}
            disabled={disabled}
            onCheckedChange={(next) => {
              saveToggle('pushStock', next);
            }}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="connection-push-price">{t('connections.pushSettings.price')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('connections.pushSettings.priceHint')}
            </p>
          </div>
          <Switch
            id="connection-push-price"
            checked={pushPrice}
            disabled={disabled}
            onCheckedChange={(next) => {
              saveToggle('pushPrice', next);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
