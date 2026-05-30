import type { ReactElement } from 'react';

import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getApiErrorMessage } from '@/lib/api';

interface Props {
  error: unknown;
  onRetry: () => void;
  /** Widget içi kompakt görünüm; varsayılan tam genişlik kart */
  variant?: 'card' | 'compact';
}

export function AccountingOverviewErrorState({
  error,
  onRetry,
  variant = 'card',
}: Props): ReactElement {
  const { t } = useTranslation();

  const body = (
    <div className="space-y-2">
      <p className="text-sm font-medium text-destructive">{t('accounting.overviewError')}</p>
      <p className="text-sm text-muted-foreground">{getApiErrorMessage(error)}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          onRetry();
        }}
      >
        {t('common.retry')}
      </Button>
    </div>
  );

  if (variant === 'compact') {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">{body}</div>
    );
  }

  return (
    <Card className="border-destructive/40 bg-destructive/5">
      <CardContent className="py-6">{body}</CardContent>
    </Card>
  );
}
