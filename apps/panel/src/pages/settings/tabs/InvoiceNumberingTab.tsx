import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function InvoiceNumberingTab(): ReactElement {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.invoiceNumberingTitle')}</CardTitle>
          <CardDescription>{t('settings.invoiceNumberingHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3">
            <p className="text-sm font-medium text-primary">
              {t('settings.invoiceNumberingFormatLabel')}
            </p>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {t('settings.invoiceNumberingFormatExample', { year })}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('settings.invoiceNumberingAutoNote')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
