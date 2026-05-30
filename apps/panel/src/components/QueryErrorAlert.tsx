import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage } from '@/lib/api';

interface Props {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}

export function QueryErrorAlert({
  error,
  title,
  onRetry,
  className,
}: Props): ReactElement {
  const { t } = useTranslation();

  return (
    <Alert variant="destructive" className={className}>
      <AlertTitle>{title ?? t('common.loadErrorTitle')}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{getApiErrorMessage(error)}</p>
        {onRetry ? (
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
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
